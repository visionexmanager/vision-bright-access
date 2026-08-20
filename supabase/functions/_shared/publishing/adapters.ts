// Phase 8, PR C1 — the adapters that exist today: none, and a fake.
//
// Every platform in PLATFORMS returns `not_configured`. That is
// the truthful answer and not a placeholder to be filled in casually: a real
// adapter needs a reviewed app, granted publishing permissions, an assigned
// asset, a resolved credential and a tested request shape. Visionex has a Meta
// business portfolio and an account with full access to it, and full access to
// a portfolio with no assets assigned grants publishing to nothing. Until each
// of those is real and tested, an adapter that "mostly works" is worse than one
// that refuses, because the failure mode of the first is a post nobody meant to
// send.
//
// The runner treats `not_configured` as a refusal, never as success, and does
// not mark the attempt dispatched — so an unconfigured platform costs a failed
// attempt and can never park a slot.

import type {
  AdapterOutcome,
  AdapterReadiness,
  Platform,
  PublishAdapter,
  PublishRequest,
} from "./types.ts";
import { PLATFORMS } from "./types.ts";

/** The code every real platform answers with today. */
export const NOT_CONFIGURED = "adapter_not_configured";

/**
 * A platform Visionex has not integrated. It answers `readiness` and nothing
 * else: `publish` throws, because reaching it would mean the runner ignored the
 * readiness answer, and that is a bug rather than a runtime condition.
 */
export function notConfiguredAdapter(platform: Platform): PublishAdapter {
  return {
    platform,
    name: `${platform}:not-configured`,
    readiness(): AdapterReadiness {
      return {
        ready: false,
        errorCode: NOT_CONFIGURED,
        errorMessage: `No publishing adapter is configured for ${platform}.`,
      };
    },
    // Rejects rather than throwing synchronously: publish() returns a Promise
    // in the interface, and a synchronous throw would escape the caller's
    // Promise.race instead of being handled as an adapter failure.
    publish(): Promise<AdapterOutcome> {
      return Promise.reject(new Error(
        `${platform} has no publishing adapter; publish() must not be reached when readiness() refuses.`,
      ));
    },
  };
}

/** Every real platform, all refusing. This is the production registry for PR C1. */
export function defaultAdapters(): Map<Platform, PublishAdapter> {
  return new Map(PLATFORMS.map((platform) => [platform, notConfiguredAdapter(platform)]));
}

// ── The deterministic fake ───────────────────────────────────────────────────

/** One scripted answer. `hang` never resolves; the runner's timeout decides. */
export type FakeStep =
  | { outcome: "published"; externalPostId?: string; externalUrl?: string }
  | { outcome: "rejected"; errorCode?: string; errorMessage?: string }
  | { outcome: "unknown"; errorCode?: string; errorMessage?: string }
  | { outcome: "throws"; message?: string }
  | { outcome: "hang" };

export interface FakeAdapterOptions {
  platform?: Platform;
  /** Answered by readiness(). Defaults to ready. */
  ready?: boolean;
  readyErrorCode?: string;
  /**
   * Called after the outcome is decided but before it is returned — the seam
   * for "the platform accepted the post and then this process died". Throwing
   * here simulates a crash that happens strictly after the external effect.
   */
  onAfterEffect?: (request: PublishRequest, outcome: AdapterOutcome) => void;
}

export interface FakeAdapter extends PublishAdapter {
  /** Every request the runner passed to publish(), in order. */
  readonly calls: PublishRequest[];
  /** How many times publish() was entered. The duplicate-publishing counter. */
  readonly dispatchCount: number;
}

/**
 * An adapter that answers from a script, in order, with no clock and no
 * randomness. The last step repeats once the script is exhausted, so a test
 * that runs the worker more times than it scripted still gets a defined answer
 * rather than an accidental success.
 *
 * `calls` is the assertion surface that matters: the whole phase exists to keep
 * its length at one per intended publication.
 */
export function createFakeAdapter(
  script: FakeStep[] = [{ outcome: "published" }],
  options: FakeAdapterOptions = {},
): FakeAdapter {
  const platform = options.platform ?? "facebook";
  const calls: PublishRequest[] = [];
  let index = 0;

  const adapter: FakeAdapter = {
    platform,
    name: `${platform}:fake`,
    get calls() {
      return calls;
    },
    get dispatchCount() {
      return calls.length;
    },
    readiness(): AdapterReadiness {
      return options.ready === false
        ? { ready: false, errorCode: options.readyErrorCode ?? NOT_CONFIGURED }
        : { ready: true };
    },
    publish(request: PublishRequest): Promise<AdapterOutcome> {
      calls.push(request);
      const step = script[Math.min(index, script.length - 1)] ?? { outcome: "published" as const };
      index += 1;

      if (step.outcome === "hang") return new Promise<AdapterOutcome>(() => {});
      if (step.outcome === "throws") {
        return Promise.reject(new Error(step.message ?? "simulated adapter failure"));
      }

      const outcome: AdapterOutcome =
        step.outcome === "published"
          ? {
              status: "published",
              externalPostId: step.externalPostId ?? `fake-post-${calls.length}`,
              externalUrl: step.externalUrl,
            }
          : step.outcome === "rejected"
            ? {
                status: "rejected",
                errorCode: step.errorCode ?? "platform_rejected",
                errorMessage: step.errorMessage,
              }
            : {
                status: "unknown",
                errorCode: step.errorCode ?? "platform_timeout",
                errorMessage: step.errorMessage,
              };

      // The external effect has happened by this point. A throw here is a crash
      // after the post exists and before anything could be recorded.
      options.onAfterEffect?.(request, outcome);
      return Promise.resolve(outcome);
    },
  };

  return adapter;
}
