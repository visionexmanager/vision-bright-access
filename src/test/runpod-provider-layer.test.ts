// The compute provider layer: what it promises, and what it must never leak.
//
// `compute.ts` is pure — no Deno, no fetch, no environment — so it is imported
// and executed here rather than read as text. `runpod.ts` talks to a network
// and an environment, so it is asserted at the source, which is how every
// other Edge Function in this suite is covered.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  SAFE_MESSAGE,
  TERMINAL,
  computeError,
  isBillable,
  isTerminal,
  safeFailure,
  type ComputeErrorCode,
  type ComputeStatus,
} from "../../supabase/functions/_shared/providers/compute.ts";

const runpod = readFileSync("supabase/functions/_shared/providers/runpod.ts", "utf8");
const compute = readFileSync("supabase/functions/_shared/providers/compute.ts", "utf8");
const migration = readFileSync(
  "supabase/migrations/20261036000000_runpod_provider_row_inactive.sql", "utf8");

/** Negative assertions run against code, never against the prose explaining it. */
const code = (src: string) =>
  src.split("\n")
    .filter((l) => {
      const t = l.trimStart();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*") && !t.startsWith("--");
    })
    .join("\n");

describe("job status is Visionex's vocabulary, not a vendor's", () => {
  it("names the four terminal states and no others", () => {
    expect([...TERMINAL].sort()).toEqual(["cancelled", "completed", "failed", "timed_out"]);
    for (const s of ["queued", "running"] as ComputeStatus[]) {
      expect(isTerminal(s), s).toBe(false);
    }
  });

  it("bills only a completed job", () => {
    expect(isBillable("completed")).toBe(true);
    for (const s of ["queued", "running", "failed", "cancelled", "timed_out"] as ComputeStatus[]) {
      expect(isBillable(s), s).toBe(false);
    }
  });

  it("maps every RunPod status, and treats an unknown one as failure", () => {
    // Reading an unrecognised vendor state as `completed` would settle a
    // reservation for work that may not exist. Failing releases it instead.
    for (const vendor of ["IN_QUEUE", "IN_PROGRESS", "COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"]) {
      expect(runpod, vendor).toContain(vendor);
    }
    expect(runpod).toContain('|| "failed"');
  });
});

describe("a failure a person reads names no infrastructure", () => {
  const codes = Object.keys(SAFE_MESSAGE) as ComputeErrorCode[];

  it("has a safe sentence for every code", () => {
    expect(codes.length).toBeGreaterThan(10);
    for (const c of codes) {
      expect(SAFE_MESSAGE[c].length, c).toBeGreaterThan(10);
    }
  });

  it("never mentions a vendor, an endpoint, a GPU or a cost", () => {
    const forbidden = [
      /runpod/i, /hetzner/i, /openai/i, /elevenlabs/i, /gpu/i, /endpoint/i,
      /\$\d/, /\bcost\b/i, /margin/i, /worker/i, /container/i, /api key/i,
    ];
    for (const c of codes) {
      for (const pattern of forbidden) {
        expect(SAFE_MESSAGE[c], `${c} leaks ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it("tells the customer the money is safe where that is true", () => {
    for (const c of ["PROVIDER_TIMEOUT", "PROVIDER_FAILED", "OUTPUT_INVALID"] as ComputeErrorCode[]) {
      expect(SAFE_MESSAGE[c], c).toContain("Nothing was charged");
    }
  });

  it("marks only transient failures retryable", () => {
    for (const c of ["PROVIDER_UNAVAILABLE", "PROVIDER_TIMEOUT"] as ComputeErrorCode[]) {
      expect(safeFailure(c).retryable, c).toBe(true);
    }
    // Retrying any of these burns money to reach the same answer.
    for (const c of ["INVALID_INPUT", "AUTH_REQUIRED", "PLAN_REQUIRED",
                     "INSUFFICIENT_VX", "RATE_LIMITED", "PAYLOAD_TOO_LARGE"] as ComputeErrorCode[]) {
      expect(safeFailure(c).retryable, c).toBe(false);
    }
  });

  it("builds an error from the code alone, so a provider's words cannot ride along", () => {
    expect(safeFailure("PROVIDER_FAILED").message).toBe(SAFE_MESSAGE.PROVIDER_FAILED);
    expect(computeError("RATE_LIMITED", "x").retryable).toBe(false);
  });
});

describe("the adapter is server-only, and structurally so", () => {
  it("nothing under src/ imports it", () => {
    // A browser that could import this would need the key to use it, and a
    // key in a bundle is a key everybody has.
    const hits = readFileSync("src/lib/api/edgeFunctions.ts", "utf8");
    expect(hits).not.toContain("providers/runpod");
    expect(hits).not.toContain("RUNPOD");
  });

  it("reads the key from the Edge Function environment and nowhere else", () => {
    expect(runpod).toContain('Deno.env.get("RUNPOD_API_KEY")');
    expect(code(runpod)).not.toContain("VITE_");
    expect(code(runpod)).not.toMatch(/from\s+["']@\//);
  });

  it("never returns, logs or stores the key or the header", () => {
    const body = code(runpod);
    // The header is built inline at the call and referenced nowhere else.
    expect((body.match(/authorization/gi) ?? []).length).toBe(1);
    expect(body).not.toMatch(/console\.(log|info|warn|error)\([^)]*apiKey/);
    expect(body).not.toMatch(/metadata[^}]*apiKey/);
    expect(body).not.toContain("return cfg");
  });

  it("puts the vendor's own message in metadata, never in what a user reads", () => {
    expect(runpod).toContain("providerMessage");
    // The user-facing error always comes from safeFailure.
    expect(runpod).toContain('error: status === "completed"');
    expect(code(runpod)).not.toMatch(/message:\s*providerMessage/);
  });
});

describe("the job lifecycle is asynchronous by default", () => {
  it("submits with /run rather than holding the connection open on /runsync", () => {
    expect(runpod).toContain('"/run"');
    expect(code(runpod)).not.toContain("/runsync");
  });

  it("uses the documented path shape, with the job id as a path segment", () => {
    expect(runpod).toContain("`/status/${encodeURIComponent(providerJobId)}`");
    expect(runpod).toContain("`/cancel/${encodeURIComponent(providerJobId)}`");
    expect(runpod).toContain("https://api.runpod.ai/v2");
  });

  it("bounds every call with an abort, so nothing can hang a function", () => {
    expect(runpod).toContain("AbortController");
    expect(runpod).toContain("setTimeout(() => controller.abort()");
    expect(runpod).toContain("clearTimeout(timer)");
  });

  it("sends Visionex's own idempotency key, and does not depend on the vendor's", () => {
    expect(runpod).toContain("visionex_request_id: request.idempotencyKey");
    expect(compute).toContain("idempotencyKey");
  });

  it("separates an expired result from one that never existed", () => {
    expect(runpod).toContain('safeFailure("JOB_EXPIRED")');
    expect(compute).toContain("JOB_NOT_FOUND");
  });
});

describe("three independent switches, all off", () => {
  it("the provider row ships inactive", () => {
    expect(migration).toContain("'inactive'");
    expect(migration).toContain("ON CONFLICT (slug) DO NOTHING;");
  });

  it("the environment switch defaults to off", () => {
    expect(runpod).toContain('Deno.env.get("RUNPOD_ENABLED") === "true"');
  });

  it("readiness refuses before a request is built, and says which kind of off", () => {
    expect(runpod).toContain("export function runpodReadiness");
    expect(runpod).toContain('safeFailure("PROVIDER_DISABLED")');
    expect(runpod).toContain('safeFailure("NOT_CONFIGURED")');
  });

  it("carries no endpoint id, because no endpoint exists", () => {
    expect(migration).toContain("'endpoint_id', null");
    // A plausible-looking id would turn "not provisioned" into "broken".
    expect(migration).not.toMatch(/'endpoint_id',\s*'[a-z0-9]+'/);
  });

  it("stores a secret name, never a secret", () => {
    expect(migration).toContain("'RUNPOD_API_KEY'");
    expect(migration).not.toMatch(/rpa_[A-Za-z0-9]{10,}/);
    expect(migration).not.toMatch(/sk-[A-Za-z0-9]{10,}/);
  });
});

/**
 * The first workload: Video Studio.
 *
 * Chosen because the fit is already there rather than because video is
 * impressive — `video-studio` has had `generate | poll | cancel | delete` and a
 * `VideoProvider` interface since it shipped, which is the same asynchronous
 * shape RunPod's `/run` + `/status` gives. RunPod becomes a third
 * implementation of that interface beside Luma and OpenAI, so the job table,
 * the storage path and the handlers are untouched.
 */
const videoStudio = readFileSync("supabase/functions/video-studio/index.ts", "utf8");

describe("RunPod is a third VideoProvider, not a second architecture", () => {
  it("implements the interface video-studio already had", () => {
    expect(videoStudio).toContain("class RunPodVideoProvider implements VideoProvider");
    for (const method of ["generateVideo", "pollJob", "cancelJob", "fetchAsset"]) {
      expect(videoStudio, method).toContain(method);
    }
  });

  it("delegates to the shared adapter rather than speaking RunPod itself", () => {
    expect(videoStudio).toContain('from "../_shared/providers/runpod.ts"');
    expect(videoStudio).toContain("runpodAdapter(");
    // The vendor's URL belongs to the adapter; this file must not build one.
    expect(code(videoStudio)).not.toContain("api.runpod.ai");
  });

  it("leaves the existing providers and the job table alone", () => {
    expect(videoStudio).toContain("class LumaProvider");
    // OpenAI Sora was retired on 2026-09-24 and its class removed; Luma stays.
    expect(videoStudio).toContain("vx_video_jobs");
  });
});

describe("the output lands in Visionex storage, not on a worker", () => {
  it("declares its asset URLs non-public, which forces the download path", () => {
    const cls = videoStudio.slice(videoStudio.indexOf("class RunPodVideoProvider"));
    expect(cls.slice(0, cls.indexOf("\n}"))).toContain("publicAssetUrls = false");
  });

  it("treats a completed job with unreadable output as a failure", () => {
    // Marking it complete would settle the reservation for something the user
    // never receives.
    expect(videoStudio).toContain("the result could not be read");
  });
});

describe("the worker's output is not trusted", () => {
  const cls = videoStudio.slice(
    videoStudio.indexOf("class RunPodVideoProvider"),
    videoStudio.indexOf("function getProvider"));

  it("accepts exactly one shape, over https, on an allow-listed host", () => {
    expect(cls).toContain("video_url");
    expect(cls).toContain('url.protocol !== "https:"');
    expect(cls).toContain("allowedHosts.some");
  });

  it("fails closed when no host is allow-listed", () => {
    // `.some` on an empty array is false, and the comment says so — an
    // unconfigured deployment must not fetch arbitrary hosts.
    expect(cls).toContain("An empty allowlist means nothing is accepted");
  });

  it("re-checks the host at the fetch, because that is the call that leaves", () => {
    expect(cls).toMatch(/async fetchAsset[\s\S]{0,200}isAllowed\(url\)/);
  });

  it("forwards named fields only, so no worker argument can be smuggled", () => {
    for (const field of ["prompt:", "duration_sec:", "aspect_ratio:", "resolution:", "fps:", "seed:"]) {
      expect(cls, field).toContain(field);
    }
    expect(cls).not.toContain("...params");
    expect(cls).not.toContain("...body");
  });
});

describe("selection is the server's, and RunPod is never the default", () => {
  it("auto resolves to luma, never runpod", () => {
    // Since the FAL recovery (2026-09-26) auto may also mean FAL — only when
    // Luma has no key and the fal-video row is routable. Never RunPod.
    expect(videoStudio).toContain('if (!requested) requested = !lumaKey && opts.falRoutable && falKey ? "fal" : "luma";');
    expect(videoStudio).toContain("\"auto\" never resolves to RunPod");
  });

  it("reads endpoint and allowed hosts from the server environment", () => {
    expect(videoStudio).toContain('Deno.env.get("RUNPOD_VIDEO_ENDPOINT_ID")');
    expect(videoStudio).toContain('Deno.env.get("RUNPOD_VIDEO_ASSET_HOSTS")');
    expect(videoStudio).toContain('Deno.env.get("RUNPOD_API_KEY")');
  });

  it("refuses before building a request when any switch is off", () => {
    expect(videoStudio).toContain("runpodReadiness(endpointId)");
    expect(videoStudio).toMatch(/if \(!readiness\.ready\)[\s\S]{0,200}throw new Error/);
    // The normalized sentence, not the reason: disabled and misconfigured look
    // the same to a user and different to an operator.
    expect(videoStudio).toContain("readiness.reason?.message");
  });
});

describe("idempotency is Visionex's, and exists before the provider is called", () => {
  it("passes the job row id, which is created before the provider call", () => {
    expect(videoStudio).toContain("idempotencyKey:  job.id");
    const insertAt = videoStudio.indexOf('.from("vx_video_jobs")');
    const submitAt = videoStudio.indexOf("provider.generateVideo(");
    expect(insertAt).toBeGreaterThan(-1);
    expect(submitAt, "the provider is called before the job row exists")
      .toBeGreaterThan(insertAt);
  });

  it("requires the key rather than letting a caller omit it", () => {
    const params = videoStudio.slice(videoStudio.indexOf("interface VideoGenerateParams"));
    expect(params.slice(0, params.indexOf("\n}"))).toContain("idempotencyKey: string;");
  });
});

describe("it changes no existing billing or entitlement rule", () => {
  it("adds one row and creates no table", () => {
    expect(migration).toContain("INSERT INTO public.ph_providers");
    expect(migration).not.toMatch(/CREATE TABLE/i);
    expect(migration).not.toMatch(/ALTER TABLE .* DROP/i);
  });

  it("does not touch pricing, VX or plans", () => {
    for (const forbidden of ["central_pricing_registry", "vx_price", "user_points",
                             "billing_plans", "vx_reserve", "user_subscriptions"]) {
      expect(code(migration), forbidden).not.toContain(forbidden);
    }
  });

  it("the adapter knows nothing about VX, plans or prices", () => {
    // The layering: router chooses, meter bills, adapter speaks a dialect.
    for (const forbidden of ["vx_reserve", "vx_settle", "user_points", "central_pricing_registry",
                             "billing_plans", "user_has_section", "maySeeSection"]) {
      expect(code(runpod), forbidden).not.toContain(forbidden);
      expect(code(compute), forbidden).not.toContain(forbidden);
    }
  });
});
