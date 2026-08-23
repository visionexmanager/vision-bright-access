// Where the sender is, between one webhook delivery and the next.
//
// An Edge Function is a fresh process per request and can be several processes
// at once, so anything held in a module-level variable is gone by the time the
// next message arrives — or, worse, belongs to somebody else. State lives in
// `whatsapp_conversations`, one row per phone number, which is the table this
// assistant already keeps. No new table: the session *is* the conversation, and
// a second table keyed on the same phone number would only be a way for the two
// to disagree.
//
// What is kept here is navigation state and short-lived working context. What
// is deliberately not kept here is anything permanent about the person — their
// language, their voice preference and their verbosity live in their own
// columns, are not part of the session, and survive a timeout.
//
// Pure: reads a row, returns an object; returns the columns to write. Nothing
// in this file contacts anything.

import { isSupportedLanguage, type SupportedLanguage } from "./whatsapp.ts";
import { nodeById, pathTo, ROOT_ID } from "./whatsappCatalog.ts";

/** JSON that survives a round trip through a jsonb column. */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/**
 * Something the assistant started and has not finished.
 *
 * Recorded so `#` can cancel it and so a timeout can clear it, rather than the
 * sender being left in a state they cannot see and cannot leave.
 */
export interface PendingOperation {
  /** e.g. "awaiting_image", "awaiting_location". Named by the feature. */
  operation: string;
  /** ISO timestamp. A pending operation is also subject to the session timeout. */
  startedAt: string;
  context?: Json;
}

export interface SessionState {
  /** Root-first node ids. Always starts at the root; never empty. */
  path: string[];
  /** The action node the sender is inside, if any. */
  feature: string | null;
  /** Where inside that feature, named by the feature itself. */
  step: string | null;
  pending: PendingOperation | null;
  /** Short-lived working context. Not a place for anything permanent. */
  context: Record<string, Json>;
  /** ISO timestamp of the last interaction, or null for a session never used. */
  updatedAt: string | null;
}

/** The node the sender is currently looking at. */
export const currentNodeId = (session: SessionState): string =>
  session.path[session.path.length - 1] ?? ROOT_ID;

/** A session at the main menu with nothing pending. */
export function freshSession(): SessionState {
  return { path: [ROOT_ID], feature: null, step: null, pending: null, context: {}, updatedAt: null };
}

/**
 * How long a session may sit idle before its working state is dropped.
 *
 * Configurable rather than compiled in, because the right number is a product
 * decision that will change: too short and somebody who put the phone down
 * mid-task loses it, too long and a stale "send me the photo" answers a
 * photograph sent tomorrow about something else entirely.
 */
export const DEFAULT_SESSION_TIMEOUT_MINUTES = 30;

export function sessionTimeoutMs(
  read: (name: string) => string | undefined = defaultEnv,
): number {
  const raw = Number(read("WHATSAPP_SESSION_TIMEOUT_MINUTES"));
  const minutes = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_SESSION_TIMEOUT_MINUTES;
  // A ceiling as well as a floor: an unbounded value from a typo in the
  // dashboard would mean state that never expires.
  return Math.min(Math.max(minutes, 1), 24 * 60) * 60_000;
}

function defaultEnv(name: string): string | undefined {
  const deno = (globalThis as { Deno?: { env?: { get(key: string): string | undefined } } }).Deno;
  return deno?.env?.get(name);
}

/** Whether this session has been idle long enough to be dropped. */
export function isStale(session: SessionState, nowMs: number, timeoutMs: number): boolean {
  if (!session.updatedAt) return false;
  const last = Date.parse(session.updatedAt);
  if (!Number.isFinite(last)) return true;
  return nowMs - last > timeoutMs;
}

/**
 * The row's session columns, as a session.
 *
 * Tolerant on purpose. A node this build no longer has is dropped from the
 * path, which leaves the deepest surviving ancestor â a real menu rather than
 * the top of the tree â and a column holding something that is not a path at
 * all resolves to the main menu. A person mid-conversation should never be
 * shown an error because a menu was reorganised under them.
 */
export function readSession(row: Record<string, unknown> | null | undefined): SessionState {
  const session = freshSession();
  if (!row) return session;

  const rawPath = row.nav_path;
  if (Array.isArray(rawPath)) {
    const path = rawPath.filter((id): id is string => typeof id === "string" && !!nodeById(id));
    // The path has to still be a real chain of parents, or it is not a path.
    if (path.length > 0 && path[0] === ROOT_ID && isContiguous(path)) session.path = path;
  }

  const feature = row.current_feature;
  if (typeof feature === "string" && nodeById(feature)) session.feature = feature;

  const step = row.current_step;
  if (typeof step === "string" && step) session.step = step;

  const pending = row.pending_operation;
  if (pending && typeof pending === "object" && !Array.isArray(pending)) {
    const candidate = pending as Record<string, unknown>;
    if (typeof candidate.operation === "string" && typeof candidate.startedAt === "string") {
      session.pending = {
        operation: candidate.operation,
        startedAt: candidate.startedAt,
        context: (candidate.context ?? null) as Json,
      };
    }
  }

  const context = row.session_context;
  if (context && typeof context === "object" && !Array.isArray(context)) {
    session.context = context as Record<string, Json>;
  }

  const updatedAt = row.session_updated_at;
  if (typeof updatedAt === "string") session.updatedAt = updatedAt;

  return session;
}

function isContiguous(path: string[]): boolean {
  for (let i = 1; i < path.length; i++) {
    if (nodeById(path[i])?.parent !== path[i - 1]) return false;
  }
  return true;
}

/** The columns to write back. Only session state: nothing permanent is here. */
export function sessionColumns(session: SessionState, nowIso: string): Record<string, unknown> {
  return {
    nav_path: session.path,
    current_feature: session.feature,
    current_step: session.step,
    pending_operation: session.pending,
    session_context: session.context,
    session_updated_at: nowIso,
  };
}

// ── Moving around ─────────────────────────────────────────────────────────
//
// Each returns a new session rather than mutating one, so the engine can decide
// between two candidate moves without having already made one.

/** Open a node, keeping the path a real chain from the root. */
export function enter(session: SessionState, nodeId: string): SessionState {
  const node = nodeById(nodeId);
  if (!node) return session;
  return {
    ...session,
    path: pathTo(nodeId),
    feature: node.kind === "action" ? node.id : null,
    step: null,
    pending: null,
  };
}

/** One level up. At the root this is a no-op, by design rather than by accident. */
export function goBack(session: SessionState): SessionState {
  if (session.path.length <= 1) return { ...session, feature: null, step: null, pending: null };
  const path = session.path.slice(0, -1);
  return { ...session, path, feature: null, step: null, pending: null };
}

/** Straight to the main menu, dropping any working state. */
export function goHome(session: SessionState): SessionState {
  return { ...session, path: [ROOT_ID], feature: null, step: null, pending: null, context: {} };
}

/** Drop the pending operation but stay where you are. */
export function cancelPending(session: SessionState): SessionState {
  return { ...session, pending: null, step: null };
}

/** Record something the feature is waiting for. */
export function withPending(session: SessionState, pending: PendingOperation): SessionState {
  return { ...session, pending, step: pending.operation };
}

/**
 * What a timeout leaves behind.
 *
 * Navigation and working context go; the row's own preference columns are not
 * touched by this file at all, which is what makes "your language survived but
 * your half-finished upload did not" the behaviour rather than an aspiration.
 */
export const afterTimeout = (): SessionState => freshSession();

/** The language to answer in: the stored preference, else what was detected. */
export function sessionLanguage(
  preferred: string | null | undefined,
  detected: SupportedLanguage,
): SupportedLanguage {
  return isSupportedLanguage(preferred) ? preferred : detected;
}
