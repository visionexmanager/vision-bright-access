// What this channel is allowed to say about itself.
//
// ── The constraint that shapes everything here ──────────────────────────────
//
// This repository is public and its CI logs are world-readable. The diagnose
// workflow prints function logs into a job summary anybody can open. So a log
// line is not a debugging convenience that happens to be visible — it is
// published, permanently, the moment it is written.
//
// And the people using this channel are blind or low-vision customers asking
// for help with their accounts, photographing documents, and sharing where they
// are standing. A single careless field is somebody's address in a search index.
//
// ── So the rule is an allowlist, not a denylist ─────────────────────────────
//
// A denylist is a list of the leaks somebody thought of. The next field added
// to a log call is not on it, and is therefore published. `sanitiseFields`
// inverts that: a field is dropped unless its name is on `TELEMETRY_FIELDS`,
// which means the failure mode of forgetting is a missing number in a log
// rather than a customer's email in a public one.
//
// Values are checked as well as names. A key called `status` is allowed to
// exist; a `status` whose value is somebody's phone number is not, and the
// value rules below reject it whatever it is called.
//
// ── Correlation ─────────────────────────────────────────────────────────────
//
// One id per webhook delivery, generated here and carried by every line the
// delivery writes — routing, transcription, retrieval, the provider call and
// the send. It is random and belongs to nothing: it identifies the *delivery*,
// not the person, and it is gone when the log rotates. That is the whole point.
// Two hours later "why did that message get no reply" is one grep, and it is a
// grep that reveals nothing about who sent it.
//
// Pure: no `Deno`, no fetch, no database.

import { sanitiseError } from "./whatsappSafety.ts";

/**
 * A fresh correlation id.
 *
 * Random, sixteen hex characters, derived from nothing. Deliberately not the
 * message id, the conversation id or a hash of the phone number: a value
 * derived from the sender is a value that links two log lines to one person
 * across time, which is exactly what this must not do. `crypto.randomUUID` is
 * used where it exists and a bounded fallback where it does not, so this
 * function cannot be the thing that throws.
 */
export function newCorrelationId(): string {
  try {
    const uuid = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID?.();
    if (uuid) return uuid.replace(/-/g, "").slice(0, 16);
  } catch {
    // Falls through to the arithmetic below.
  }
  return Array.from({ length: 4 }, () => Math.floor(Math.random() * 0xffff).toString(16).padStart(4, "0")).join("");
}

/**
 * Every field name that may appear in a log line.
 *
 * Each one is a count, a duration, a status, an enumerated label, or an
 * identifier that names a *thing this system did* rather than a person. Adding
 * to this list is the moment to ask "could this ever hold something somebody
 * typed?" — and if the answer is anything but a flat no, the answer is a length
 * or a boolean instead of the value.
 *
 * Notably absent, and permanently so: anything holding message text, a phone
 * number, an email address, a name, a date of birth, a gender, a media URL, a
 * token, a provider response body, a passage, a prompt, or a transcript.
 */
export const TELEMETRY_FIELDS: readonly string[] = [
  // Who and what, without saying who.
  "correlation",
  "conversation",
  "message",
  "kind",

  // Navigation and routing.
  "outcome",
  "reason",
  "node",
  "feature",
  "via",
  "selection",
  "state",
  "step",
  "menu",

  // Sizes and counts. Never the thing being counted.
  "chars",
  "parts",
  "passages",
  "candidates",
  "turns",
  "attempt",
  "count",

  // Timing.
  "ms",

  // Outcomes.
  "status",
  "code",
  "provider",
  "model",
  "medium",
  "sent",
  "spokenFailed",
  "replyKind",
  "problem",
  "category",
  "language",
  "verified",
  "ok",
];

const ALLOWED = new Set(TELEMETRY_FIELDS);

/** Longest string value any field may carry. Labels, not sentences. */
export const MAX_FIELD_CHARS = 64;

/**
 * Shapes a safe label never has.
 *
 * Belt and braces on top of the allowlist, and each one earns its place:
 *
 *   `@`            an email address, wherever it ended up
 *   four+ digits   a phone number, an account number, a card, a one-time code
 *   whitespace     a label is one word; a sentence is a message body
 *   non-ASCII      every enumerated label in this system is ASCII, so anything
 *                  else is text somebody wrote — in Arabic, most likely, which
 *                  is precisely the audience whose words must not be published
 */
const UNSAFE_VALUE = /[@\s]|[0-9]{4,}|[^\x20-\x7E]/;

/**
 * What a label is allowed to look like, positively.
 *
 * The rules above are a denylist of the shapes that are obviously somebody's
 * data, and a denylist only catches what its author thought of:
 * `<script>alert(1)</script>` is pure ASCII, has no `@`, no whitespace and no
 * run of digits, and sailed straight through. So the shapes are the second
 * check and this is the first — every enumerated label this system emits is a
 * snake_case or kebab-case word, and anything that is not one is text somebody
 * wrote rather than a label this code chose.
 */
const SAFE_LABEL = /^[a-z][a-z0-9_-]*$/i;

/**
 * The same question for a machine identifier.
 *
 * Wider, because these carry the punctuation real ids have: `services.weather`,
 * `llama-3.3-70b-versatile`, `wamid.HBgL…`, a UUID. Still no whitespace, no
 * angle brackets, no quotes — nothing that is prose or markup.
 */
const SAFE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

/**
 * Fields whose value is written by this system, never by a person.
 *
 * The digit rule exists to catch a phone number, an account number or a
 * one-time code that has ended up somewhere it should not be. It also catches
 * `claude-haiku-4-5-20251001` and every other date-stamped model id, and losing
 * the model name from the logs would cost the one field that answers "which
 * provider actually served this". These come out of the provider registry, the
 * catalog and this file's own enumerations — a customer cannot influence any of
 * them — so they keep the rest of the rules and drop that one.
 *
 * `conversation`, `message` and `correlation` are ids: a UUID and Meta's
 * `wam.…` are both digit-bearing, and both name a record rather than a person.
 */
const MACHINE_FIELDS = new Set([
  "correlation",
  "conversation",
  "message",
  "provider",
  "model",
  "node",
  "feature",
  "code",
]);

/** One value, if it is safe to publish. `undefined` when it is not. */
function safeValue(key: string, value: unknown): string | number | boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") {
    if (!value) return undefined;
    if (value.length > MAX_FIELD_CHARS) return undefined;
    // Both directions: it has to look like the thing it claims to be, and it
    // has to not look like anybody's data.
    const machine = MACHINE_FIELDS.has(key);
    if (!(machine ? SAFE_IDENTIFIER : SAFE_LABEL).test(value)) return undefined;
    if (!machine && UNSAFE_VALUE.test(value)) return undefined;
    return value;
  }
  // Objects, arrays, functions and symbols are never labels. An object is how a
  // whole response body ends up in a log by accident.
  return undefined;
}

/**
 * The fields that may be published, out of the fields that were offered.
 *
 * Never throws. A getter that explodes, a proxy, a circular object, a null
 * prototype — a log call must not be able to take down the reply it was
 * describing, and this is the function every log call goes through.
 */
export function sanitiseFields(fields: Record<string, unknown>): Record<string, string | number | boolean> {
  const safe: Record<string, string | number | boolean> = {};
  try {
    for (const key of Object.keys(fields ?? {})) {
      if (!ALLOWED.has(key)) continue;
      let raw: unknown;
      try {
        raw = (fields as Record<string, unknown>)[key];
      } catch {
        continue; // a getter that throws
      }
      const value = safeValue(key, raw);
      if (value !== undefined) safe[key] = value;
    }
  } catch {
    return safe;
  }
  return safe;
}

/** What a logger is given about the delivery it belongs to. */
export interface TelemetryBase {
  /** The per-delivery correlation id. */
  correlation: string;
  /** The conversation row's id. Names a thread, never a person. */
  conversation?: string;
  /** Meta's message id. Names one delivery, and is not derived from the sender. */
  message?: string;
  kind?: string;
}

export interface Telemetry {
  /** Record one event. Never throws, whatever it is handed. */
  (event: string, fields?: Record<string, unknown>): void;
  /** The correlation id, for handing to a module that prints its own lines. */
  readonly correlation: string;
  /** Record a failure as a normalised code and status, never as a message. */
  fail(event: string, error: unknown, fields?: Record<string, unknown>): void;
}

export interface TelemetryOptions {
  /** Injected for tests; production writes to the console. */
  write?: (line: string) => void;
  /** Injected for tests; the default is the real clock. */
  now?: () => number;
  /** The moment the delivery started, so every line carries an elapsed time. */
  startedAt?: number;
}

/**
 * A logger for one webhook delivery.
 *
 * Every line is one JSON object on one line, which is what makes a log
 * greppable and a diagnostic tool able to show a summary rather than a dump.
 * `at`, `event`, `correlation` and `ms` are always present; everything else has
 * to survive the allowlist.
 *
 * ── Why nothing here can throw ──────────────────────────────────────────────
 *
 * Logging is not the business. A delivery that answered the customer and then
 * died serialising a log line has failed in the only way that actually matters,
 * and it would fail *after* the reply — so Meta would redeliver and the
 * customer would be answered twice. Every path out of this function is guarded,
 * including the write itself.
 */
export function createTelemetry(base: TelemetryBase, options: TelemetryOptions = {}): Telemetry {
  const write = options.write ?? ((line: string) => console.log(line));
  const clock = options.now ?? Date.now;
  const startedAt = options.startedAt ?? clock();

  const emit = (event: string, fields: Record<string, unknown> = {}): void => {
    try {
      // Sanitised separately and merged after, rather than spread and then
      // sanitised. Spreading invokes every getter on the object, so one hostile
      // or broken property would throw before a single field had been read —
      // and the line describing the delivery would vanish entirely rather than
      // losing the one field that was the problem. `sanitiseFields` reads each
      // key under its own guard.
      const safe = { ...sanitiseFields(base as unknown as Record<string, unknown>), ...sanitiseFields(fields) };
      write(JSON.stringify({
        at: "whatsapp",
        event: safeValue("event", event) ?? "unknown",
        ms: clock() - startedAt,
        ...safe,
      }));
    } catch {
      // Deliberately silent. There is nothing useful to say about a failure to
      // say something, and a second attempt would fail the same way.
    }
  };

  const telemetry = emit as unknown as { -readonly [K in keyof Telemetry]: Telemetry[K] };
  telemetry.correlation = base.correlation;
  telemetry.fail = (event: string, error: unknown, fields: Record<string, unknown> = {}) => {
    // The one place an error is allowed near a log line, and it arrives as a
    // label and a number. `sanitiseError` has already dropped the message.
    const safe = sanitiseError(error);
    emit(event, { ...fields, code: safe.code, status: safe.status });
  };

  return telemetry as Telemetry;
}

/**
 * The prefix a module writes on a plain `console.error` of its own.
 *
 * Not everything can take a logger — `speakReply` and the media downloader are
 * called from deep inside a transport and print one line when a provider
 * refuses. Handing them the correlation id and nothing else lets those lines
 * join up with the structured ones in a grep, without giving a transport module
 * a reason to know what telemetry is.
 */
export const trace = (correlation: string | undefined): string =>
  correlation ? ` cid=${correlation}` : "";
