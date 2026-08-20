// Phase 9, step 6 — the adapters that actually post.
//
// Kept out of adapters.ts on purpose. That file is asserted to contain no URL,
// no fetch and no platform endpoint, and the assertion is worth more than the
// convenience of one file: the runner and its contract stay provably unable to
// contact anything, and everything that can lives here.
//
// ── The one rule these adapters exist to respect ────────────────────────────
//
// A failure reported AFTER the dispatch marker parks the slot for a human. The
// database does that deliberately — see 20260908 — because an adapter that
// classifies its own failure can pay for a mistake with a duplicate post.
//
// The consequence for anything transient, a rate limit above all, is that it
// must be caught BEFORE dispatch or it costs a parked slot. readiness() is that
// seam: once a platform answers with a throttle, the adapter refuses subsequent
// attempts in the same invocation without dispatching, so the first one costs a
// slot and the rest keep their retry budget.
//
// ── What is not here ────────────────────────────────────────────────────────
//
// No retry of any kind. A retry inside publish() is a second external call the
// database holds no marker for, which is the exact thing the marker exists to
// make impossible.

import { GRAPH_BASE } from "../meta.ts";
import { THREADS_GRAPH } from "../metaGrant.ts";
import type {
  AdapterOutcome,
  AdapterReadiness,
  PublishAdapter,
  PublishRequest,
} from "./types.ts";

/** Threads addresses its content endpoints under an explicit version. */
export const THREADS_API = `${THREADS_GRAPH}/v1.0`;

export type PublishFetch = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export interface AdapterDeps {
  /**
   * The decrypted access token for an account, or undefined.
   *
   * A function rather than a value so no token is held on the request object
   * the runner passes around, and so readiness() can answer synchronously —
   * which is what keeps an unusable account from ever costing a dispatch.
   */
  tokenFor(accountId: string): string | undefined;
  fetchImpl: PublishFetch;
  now?: () => number;
}

/**
 * Platform text ceilings. Exceeding one is refused at readiness rather than
 * sent: the platform would reject it, and a rejection after dispatch parks the
 * slot for a human when the actual fix is to shorten the text.
 */
const TEXT_LIMIT = { facebook: 63_206, instagram: 2_200, threads: 500 } as const;

// ── Composing the post ───────────────────────────────────────────────────────

/**
 * One string from the three fields the content engine produces.
 *
 * Hashtags are normalised rather than trusted: the column stores them without a
 * leading `#` in some rows and with one in others, and posting `##tag` is the
 * kind of thing nobody notices until it is on the company page.
 */
export function composeMessage(request: PublishRequest): string {
  const tags = (request.hashtags ?? [])
    .map((tag) => tag.trim().replace(/^#+/, ""))
    .filter((tag) => tag.length > 0)
    .map((tag) => `#${tag}`);

  const seen = new Set<string>();
  const unique = tags.filter((tag) => {
    const key = tag.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return [request.hook?.trim(), request.body?.trim(), unique.join(" ")]
    .filter((part) => part && part.length > 0)
    .join("\n\n");
}

// ── Reading a platform answer without keeping its text ───────────────────────

/**
 * Meta's throttling codes. A request that hits one of these did not create a
 * post, but it still arrives after the dispatch marker, so the value of
 * recognising it is that the NEXT attempt is refused before dispatching.
 */
const THROTTLE_CODES = new Set([4, 17, 32, 613]);

export interface PlatformAnswer {
  readonly ok: boolean;
  readonly body?: Record<string, unknown>;
  /** A short machine code, matching the shape social_publications accepts. */
  readonly errorCode?: string;
  readonly throttled?: boolean;
  /** True when the platform gave no usable answer at all. */
  readonly unknown?: boolean;
}

/**
 * Classify one response. The body is never returned on a failure path and never
 * folded into a message — a Meta error quotes the failing request, and the
 * failing request carries a bearer token.
 */
export async function readAnswer(
  call: () => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>,
): Promise<PlatformAnswer> {
  let response: { ok: boolean; status: number; json(): Promise<unknown> };
  try {
    response = await call();
  } catch {
    // The request may or may not have reached Meta. Nothing here can tell, so
    // it is unknown rather than rejected, and the database parks it.
    return { ok: false, unknown: true, errorCode: "platform_unreachable" };
  }

  const raw = await response.json().catch(() => null);
  const body = raw && typeof raw === "object" ? raw as Record<string, unknown> : null;
  const error = body?.error && typeof body.error === "object"
    ? body.error as Record<string, unknown>
    : null;

  if (response.status === 429) {
    return { ok: false, throttled: true, errorCode: "platform_rate_limited" };
  }

  if (error) {
    const code = typeof error.code === "number" ? error.code : undefined;
    if (code !== undefined && THROTTLE_CODES.has(code)) {
      return { ok: false, throttled: true, errorCode: "platform_rate_limited" };
    }
    // 190 is the whole family of token problems: expired, revoked, invalidated
    // by a password change. Named separately because the fix is to reconnect
    // the account, not to retry or to edit the post.
    if (code === 190) return { ok: false, errorCode: "token_invalid" };
    if (code === 200 || code === 10) return { ok: false, errorCode: "permission_denied" };
    if (code === 100) return { ok: false, errorCode: "platform_rejected_request" };
    return { ok: false, errorCode: "platform_rejected" };
  }

  if (!response.ok || !body) {
    // A non-2xx with no error object, or an unreadable body. The request was
    // answered, but not in a way that says whether anything was created.
    return { ok: false, unknown: true, errorCode: "platform_answer_unreadable" };
  }

  return { ok: true, body };
}

function idFrom(body: Record<string, unknown> | undefined): string | undefined {
  const id = body?.id;
  return typeof id === "string" && id.trim() !== "" ? id : undefined;
}

function form(fields: Record<string, string>): string {
  return new URLSearchParams(fields).toString();
}

/** POST with the token in the header, never in the query string or the body. */
function post(
  deps: AdapterDeps,
  url: string,
  token: string,
  fields: Record<string, string>,
) {
  return deps.fetchImpl(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: form(fields),
  });
}

// ── Shared readiness ─────────────────────────────────────────────────────────

/**
 * A small mutable box per adapter instance, holding the one fact readiness
 * needs that is not on the request: whether this platform has already answered
 * with a throttle during this invocation.
 */
interface Throttle { hit: boolean }

function baseReadiness(
  request: PublishRequest,
  deps: AdapterDeps,
  throttle: Throttle,
  limit: number,
): AdapterReadiness {
  if (throttle.hit) {
    // Refused without dispatching, so the slot keeps its retry budget and is
    // picked up by a later invocation instead of being parked.
    return {
      ready: false,
      errorCode: "platform_rate_limited",
      errorMessage: "The platform throttled an earlier attempt in this run.",
    };
  }
  if (!deps.tokenFor(request.account.id)) {
    return { ready: false, errorCode: "no_access_token" };
  }
  if (!request.account.externalAccountId) {
    // The page id or Instagram account id, recorded during the OAuth upgrade.
    // Without it there is nothing to address the request to.
    return { ready: false, errorCode: "no_external_account_id" };
  }
  const message = composeMessage(request);
  if (message.length === 0) return { ready: false, errorCode: "empty_content" };
  if (message.length > limit) {
    return {
      ready: false,
      errorCode: "content_too_long",
      errorMessage: `The composed post is ${message.length} characters; the platform allows ${limit}.`,
    };
  }
  return { ready: true };
}

/** Turn a failed answer into the outcome the runner records. */
function failure(answer: PlatformAnswer, throttle: Throttle): AdapterOutcome {
  if (answer.throttled) throttle.hit = true;
  return answer.unknown
    ? { status: "unknown", errorCode: answer.errorCode ?? "platform_answer_unreadable" }
    : { status: "rejected", errorCode: answer.errorCode ?? "platform_rejected" };
}

// ── Facebook ─────────────────────────────────────────────────────────────────

/**
 * A text post to a page feed.
 *
 * Addressed by the page id and authorised by the PAGE token — the two things
 * the OAuth upgrade in step 4 exists to obtain. A user token here is refused by
 * Meta however complete the app review is.
 */
export function createFacebookAdapter(deps: AdapterDeps): PublishAdapter {
  const throttle: Throttle = { hit: false };

  return {
    platform: "facebook",
    name: "facebook:graph",
    readiness: (request) => baseReadiness(request, deps, throttle, TEXT_LIMIT.facebook),
    async publish(request): Promise<AdapterOutcome> {
      const token = deps.tokenFor(request.account.id)!;
      const pageId = request.account.externalAccountId!;

      const answer = await readAnswer(() => post(
        deps, `${GRAPH_BASE}/${pageId}/feed`, token, { message: composeMessage(request) },
      ));
      if (!answer.ok) return failure(answer, throttle);

      const id = idFrom(answer.body);
      if (!id) {
        // Meta answered 200 without an id. Something may have been created, so
        // this is unknown rather than a rejection.
        return { status: "unknown", errorCode: "no_post_id_returned" };
      }
      return {
        status: "published",
        externalPostId: id,
        externalUrl: `https://www.facebook.com/${id}`,
      };
    },
  };
}

// ── Threads ──────────────────────────────────────────────────────────────────

/**
 * Two calls: create a container, then publish it.
 *
 * A container is not a post. If the first call succeeds and the second fails
 * with an answer, nothing is public and the outcome is a rejection; if the
 * second call gives no answer, a post may exist and it is unknown. That
 * distinction is the whole reason the two are not collapsed.
 */
export function createThreadsAdapter(deps: AdapterDeps): PublishAdapter {
  const throttle: Throttle = { hit: false };

  return {
    platform: "threads",
    name: "threads:api",
    readiness: (request) => baseReadiness(request, deps, throttle, TEXT_LIMIT.threads),
    async publish(request): Promise<AdapterOutcome> {
      const token = deps.tokenFor(request.account.id)!;
      const userId = request.account.externalAccountId!;

      const container = await readAnswer(() => post(
        deps, `${THREADS_API}/${userId}/threads`, token,
        { media_type: "TEXT", text: composeMessage(request) },
      ));
      if (!container.ok) return failure(container, throttle);

      const creationId = idFrom(container.body);
      if (!creationId) return { status: "rejected", errorCode: "no_container_id" };

      const published = await readAnswer(() => post(
        deps, `${THREADS_API}/${userId}/threads_publish`, token,
        { creation_id: creationId },
      ));
      if (!published.ok) return failure(published, throttle);

      const id = idFrom(published.body);
      if (!id) return { status: "unknown", errorCode: "no_post_id_returned" };
      return { status: "published", externalPostId: id };
    },
  };
}

// ── Instagram ────────────────────────────────────────────────────────────────

/**
 * Instagram has no text-only post. Every publication is a media container, and
 * the container needs a publicly reachable image or video URL.
 *
 * `content_proposals` has no media column — the content engine produces hook,
 * body and hashtags and nothing else — so there is no image to attach and this
 * adapter refuses at readiness, which costs no dispatch and parks no slot.
 *
 * The publishing path below is written out in full rather than left as a stub,
 * because it is the documented workflow and the only thing missing is the URL.
 * When the content engine gains media, `mediaUrl` on the request is where it
 * arrives and nothing else here changes.
 */
export function createInstagramAdapter(deps: AdapterDeps): PublishAdapter {
  const throttle: Throttle = { hit: false };
  const now = deps.now ?? (() => Date.now());

  return {
    platform: "instagram",
    name: "instagram:graph",
    readiness(request): AdapterReadiness {
      const base = baseReadiness(request, deps, throttle, TEXT_LIMIT.instagram);
      if (!base.ready) return base;
      if (!request.mediaUrl) {
        return {
          ready: false,
          errorCode: "media_required",
          errorMessage:
            "Instagram publishes no text-only post, and this proposal carries no media URL.",
        };
      }
      return { ready: true };
    },
    async publish(request): Promise<AdapterOutcome> {
      const token = deps.tokenFor(request.account.id)!;
      const igId = request.account.externalAccountId!;

      // 1. The container. Accepted immediately; not yet a post.
      const container = await readAnswer(() => post(
        deps, `${GRAPH_BASE}/${igId}/media`, token,
        { image_url: request.mediaUrl!, caption: composeMessage(request) },
      ));
      if (!container.ok) return failure(container, throttle);

      const creationId = idFrom(container.body);
      if (!creationId) return { status: "rejected", errorCode: "no_container_id" };

      // 2. Wait for Meta to finish fetching the media. This is a poll of a
      //    status field, not a retry of the publish: nothing has been published
      //    yet, and the container id is stable across reads.
      const deadline = now() + 60_000;
      let state = "IN_PROGRESS";
      while (state === "IN_PROGRESS" && now() < deadline) {
        const status = await readAnswer(() => deps.fetchImpl(
          `${GRAPH_BASE}/${creationId}?fields=status_code`,
          { method: "GET", headers: { Authorization: `Bearer ${token}` } },
        ));
        if (!status.ok) return failure(status, throttle);
        const code = status.body?.status_code;
        state = typeof code === "string" ? code : "ERROR";
        if (state === "IN_PROGRESS") await sleep(2_000, now, deadline);
      }

      if (state !== "FINISHED") {
        // Nothing was published: a container that never finished cannot be.
        return {
          status: "rejected",
          errorCode: state === "IN_PROGRESS" ? "media_processing_timeout" : "media_processing_failed",
        };
      }

      // 3. Publish the finished container.
      const published = await readAnswer(() => post(
        deps, `${GRAPH_BASE}/${igId}/media_publish`, token, { creation_id: creationId },
      ));
      if (!published.ok) return failure(published, throttle);

      const id = idFrom(published.body);
      if (!id) return { status: "unknown", errorCode: "no_post_id_returned" };
      return { status: "published", externalPostId: id };
    },
  };
}

/** A bounded pause that never outlives the caller's deadline. */
function sleep(ms: number, now: () => number, deadline: number): Promise<void> {
  const remaining = Math.max(0, Math.min(ms, deadline - now()));
  if (remaining === 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, remaining));
}

/** The three platforms Visionex can publish to today, keyed for the runner. */
export function metaAdapters(deps: AdapterDeps): Array<[string, PublishAdapter]> {
  return [
    ["facebook", createFacebookAdapter(deps)],
    ["instagram", createInstagramAdapter(deps)],
    ["threads", createThreadsAdapter(deps)],
  ];
}
