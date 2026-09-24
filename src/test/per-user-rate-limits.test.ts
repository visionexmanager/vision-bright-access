// Phase 2F-2: every paid-provider function a user can reach is charged against
// a per-user daily ceiling, server-side, before the provider is called.
//
// Three layers, tested separately:
//   1. `_shared/aiDailyLimit.ts` — the edge-side helper. Pure; driven here with
//      a stub client.
//   2. `check_ai_rate_limit` — the ceilings and the lock. The SQL itself was
//      executed in PGlite when this was written (see the PR); here its
//      semantics are modelled against the ceilings parsed out of the migration,
//      so a changed number changes what these tests expect.
//   3. The wiring — each function charges under its own name, after the caller
//      is identified and before anything reaches a provider.

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  chargeDailyLimit,
  RATE_LIMITED_MESSAGE,
  secondsUntilUtcMidnight,
  type DailyLimitClient,
} from "../../supabase/functions/_shared/aiDailyLimit.ts";

const MIGRATION = "supabase/migrations/20261038000000_ai_rate_limit_serialised_and_media.sql";
const migration = readFileSync(MIGRATION, "utf8");
const CORS = { "Access-Control-Allow-Origin": "https://visionex.app" };

/** The CASE in the migration, as a map. The model below enforces exactly these. */
function ceilings(): { byName: Map<string, number>; fallback: number } {
  const byName = new Map<string, number>();
  for (const m of migration.matchAll(/WHEN '([a-z0-9-]+)'\s+THEN (\d+)/g)) byName.set(m[1], Number(m[2]));
  const fallback = Number(/ELSE (\d+)/.exec(migration)?.[1]);
  return { byName, fallback };
}

/**
 * `check_ai_rate_limit`, modelled: per user, per function, per UTC day.
 * `serialised: true` is the advisory lock; `false` is the count-then-insert the
 * migration replaced, kept only to prove the concurrency test can fail.
 */
function fakeRpc(opts: { serialised: boolean; now?: () => Date }) {
  const { byName, fallback } = ceilings();
  const rows: Array<{ user: string; fn: string; at: Date }> = [];
  const now = opts.now ?? (() => new Date());
  const locks = new Map<string, Promise<void>>();
  const tick = () => new Promise<void>((r) => setTimeout(r, 0));

  const checkOnce = async (user: string, fn: string) => {
    const t = now();
    const dayStart = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
    const count = rows.filter((r) => r.user === user && r.fn === fn && r.at.getTime() >= dayStart).length;
    await tick(); // the gap between COUNT and INSERT that concurrent calls race through
    if (count >= (byName.get(fn) ?? fallback)) return false;
    rows.push({ user, fn, at: t });
    return true;
  };

  const client: DailyLimitClient = {
    async rpc(_name, { _user_id, _function_name }) {
      if (!opts.serialised) return { data: await checkOnce(_user_id, _function_name), error: null };
      const key = `${_user_id}:${_function_name}`;
      const before = locks.get(key) ?? Promise.resolve();
      let release!: () => void;
      const mine = new Promise<void>((r) => { release = r; });
      locks.set(key, before.then(() => mine));
      await before;
      try {
        return { data: await checkOnce(_user_id, _function_name), error: null };
      } finally {
        release();
      }
    },
  };
  return { client, rows };
}

/** A paid endpoint as the functions are shaped: charge, then (maybe) call the provider. */
function endpoint(client: DailyLimitClient, fn: string) {
  const provider = vi.fn(async () => "generated");
  const handle = async (userId: string | null) => {
    if (!userId) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    const limited = await chargeDailyLimit(client, userId, fn, CORS);
    if (limited) return limited;
    return new Response(await provider(), { status: 200 });
  };
  return { handle, provider };
}

describe("chargeDailyLimit — the edge-side helper", () => {
  it("allows when the RPC says true, and asks about this user and this function", async () => {
    const rpc = vi.fn(async () => ({ data: true, error: null }));
    expect(await chargeDailyLimit({ rpc }, "user-1", "video-studio", CORS)).toBeNull();
    expect(rpc).toHaveBeenCalledWith("check_ai_rate_limit", { _user_id: "user-1", _function_name: "video-studio" });
  });

  it("refuses with a 429 that says only when to come back", async () => {
    const res = await chargeDailyLimit({ rpc: async () => ({ data: false, error: null }) }, "u", "image-generate", CORS);
    expect(res?.status).toBe(429);
    const body = await res!.json();
    expect(body).toEqual({ error: RATE_LIMITED_MESSAGE });
    // No ceiling, count, provider, model or cost in what the caller sees.
    expect(Object.keys(body)).toEqual(["error"]);
    const text = (JSON.stringify(body) + JSON.stringify([...res!.headers])).toLowerCase();
    for (const leak of ["openai", "replicate", "luma", "runpod", "sora", "groq", "usd", "cost", "vx", "ai_usage_log", "check_ai_rate_limit", "image-generate"]) {
      expect(text, leak).not.toContain(leak);
    }
    expect(res!.headers.get("Access-Control-Allow-Origin")).toBe("https://visionex.app");
    expect(Number(res!.headers.get("Retry-After"))).toBeGreaterThan(0);
  });

  it("fails closed when the RPC errors, throws, or answers anything but true", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const cases: DailyLimitClient[] = [
      { rpc: async () => ({ data: null, error: { code: "57014" } }) },
      { rpc: async () => { throw new Error("network down"); } },
      { rpc: async () => ({ data: null, error: null }) },
      { rpc: async () => ({ data: "true", error: null }) },
    ];
    for (const client of cases) {
      expect((await chargeDailyLimit(client, "u", "academy-chat", CORS))?.status).toBe(429);
    }
    quiet.mockRestore();
  });

  it("Retry-After counts down to the next UTC midnight, where the RPC's window turns", () => {
    expect(secondsUntilUtcMidnight(new Date("2026-09-24T23:59:30Z"))).toBe(30);
    expect(secondsUntilUtcMidnight(new Date("2026-09-24T00:00:00Z"))).toBe(86_400);
    expect(secondsUntilUtcMidnight(new Date("2026-09-24T23:59:59.900Z"))).toBe(1);
  });
});

describe("the ceilings, enforced per user per function per day", () => {
  it("allows below the limit, allows the request that reaches it, refuses the one past it", async () => {
    const { client } = fakeRpc({ serialised: true });
    const { handle, provider } = endpoint(client, "video-studio");
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) statuses.push((await handle("user-a")).status);
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429, 429]);
    expect(provider).toHaveBeenCalledTimes(5);
  });

  it("never calls the provider once a request is refused", async () => {
    const { client } = fakeRpc({ serialised: true });
    const { handle, provider } = endpoint(client, "generate-diet-plan");
    for (let i = 0; i < 10; i++) await handle("user-a");
    provider.mockClear();
    for (let i = 0; i < 25; i++) expect((await handle("user-a")).status).toBe(429);
    expect(provider).not.toHaveBeenCalled();
  });

  it("refuses an unauthenticated caller before any charge or provider call", async () => {
    const rpc = vi.fn(async () => ({ data: true, error: null }));
    const { handle, provider } = endpoint({ rpc }, "image-generate");
    expect((await handle(null)).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();
  });

  it("keeps users apart: one user exhausting a function leaves another untouched", async () => {
    const { client } = fakeRpc({ serialised: true });
    const { handle } = endpoint(client, "video-studio");
    for (let i = 0; i < 5; i++) await handle("user-a");
    expect((await handle("user-a")).status).toBe(429);
    expect((await handle("user-b")).status).toBe(200);
  });

  it("keeps functions apart: exhausting video leaves images untouched", async () => {
    const { client } = fakeRpc({ serialised: true });
    for (let i = 0; i < 5; i++) await endpoint(client, "video-studio").handle("user-a");
    expect((await endpoint(client, "video-studio").handle("user-a")).status).toBe(429);
    expect((await endpoint(client, "image-generate").handle("user-a")).status).toBe(200);
  });

  it("resets at the UTC day boundary", async () => {
    let clock = new Date("2026-09-24T23:59:00Z");
    const { client } = fakeRpc({ serialised: true, now: () => clock });
    const { handle } = endpoint(client, "realtime-session");
    for (let i = 0; i < 10; i++) expect((await handle("user-a")).status).toBe(200);
    expect((await handle("user-a")).status).toBe(429);
    clock = new Date("2026-09-25T00:00:01Z");
    expect((await handle("user-a")).status).toBe(200);
  });

  it("holds under concurrency: 20 simultaneous video submissions admit exactly 5", async () => {
    const { client } = fakeRpc({ serialised: true });
    const { handle, provider } = endpoint(client, "video-studio");
    const results = await Promise.all(Array.from({ length: 20 }, () => handle("user-a")));
    expect(results.filter((r) => r.status === 200)).toHaveLength(5);
    expect(results.filter((r) => r.status === 429)).toHaveLength(15);
    expect(provider).toHaveBeenCalledTimes(5);
  });

  it("the concurrency test can fail: without the lock, the same burst over-admits", async () => {
    const { client } = fakeRpc({ serialised: false });
    const { handle } = endpoint(client, "video-studio");
    const results = await Promise.all(Array.from({ length: 20 }, () => handle("user-a")));
    expect(results.filter((r) => r.status === 200).length).toBeGreaterThan(5);
  });
});

describe("check_ai_rate_limit — the migration", () => {
  it("takes a per-(user, function) advisory lock before it counts", () => {
    const lock = migration.indexOf("pg_advisory_xact_lock(");
    const count = migration.indexOf("SELECT COUNT(*)");
    expect(lock).toBeGreaterThan(0);
    expect(lock).toBeLessThan(count);
    expect(migration).toMatch(/pg_advisory_xact_lock\(\s*hashtextextended\('check_ai_rate_limit:' \|\| _user_id::text \|\| ':' \|\| _function_name, 0\)/);
  });

  it("is the latest definition of the function, so nothing later drops the lock", () => {
    const defining = readdirSync("supabase/migrations")
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .filter((f) => readFileSync(`supabase/migrations/${f}`, "utf8").includes("FUNCTION public.check_ai_rate_limit("));
    expect(defining.at(-1)).toBe(MIGRATION.split("/").pop());
  });

  it("sets the ceilings chosen for Phase 2F-2 and keeps every earlier one", () => {
    const { byName, fallback } = ceilings();
    expect(Object.fromEntries(byName)).toEqual({
      "ai-chat": 60, "academy-chat": 60, "ocr-scan": 20, "radar-ai": 20, "analyze-meal": 20,
      "generate-diet-plan": 10, "realtime-session": 10, "enrich-product": 50,
      "library-ai-assistant": 40, "library-ai-chat": 60, "library-ai-writing-assistant": 40,
      "voice-studio-clone": 5, "speech-generate": 20, "file-convert": 10,
      "ai-generate": 30, "analyze-image": 20, "speech-transcribe": 30,
      "image-generate": 20, "image-tools-generate": 20, "video-studio": 5,
    });
    expect(fallback).toBe(30);
  });

  it("stays service_role-only and touches no VX table", () => {
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.check_ai_rate_limit\(UUID, TEXT\) FROM PUBLIC, anon, authenticated;/);
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.check_ai_rate_limit(UUID, TEXT) TO service_role;");
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain("SET search_path = public");
    expect(migration).not.toMatch(/\bvx_|user_points/);
  });
});

describe("the wiring in each function", () => {
  const src = (fn: string) => readFileSync(`supabase/functions/${fn}/index.ts`, "utf8");
  /** The request handler — helpers defined above it may mention providers too. */
  const handler = (fn: string) => {
    const s = src(fn);
    const start = Math.max(s.indexOf("Deno.serve("), s.indexOf("serve(async"));
    expect(start, fn).toBeGreaterThan(0);
    return s.slice(start);
  };

  // function → the first thing in its handler that spends provider money.
  const PROVIDER_MARKER: Record<string, string> = {
    "academy-chat": "fetch(",
    "analyze-meal": "fetch(",
    "generate-diet-plan": "fetch(",
    "radar-ai": "fetch(",
    "realtime-session": "fetch(",
    "ai-generate": "structuredCompletionWithFallback(",
    "analyze-image": "structuredCompletionWithFallback(",
    "speech-transcribe": "transcribeWithWhisper(",
    "image-generate": "generateImage(",
    "image-tools-generate": "createPrediction(",
    "video-studio": "handleGenerate(",
  };

  for (const [fn, marker] of Object.entries(PROVIDER_MARKER)) {
    it(`${fn}: identifies the caller, charges under its own name, then calls the provider`, () => {
      const h = handler(fn);
      expect(src(fn)).toContain('import { chargeDailyLimit } from "../_shared/aiDailyLimit.ts";');
      const auth = h.indexOf("getUser(");
      const charge = h.indexOf("chargeDailyLimit(");
      const spend = h.indexOf(marker);
      expect(auth, `${fn} getUser`).toBeGreaterThan(0);
      expect(charge, `${fn} charge`).toBeGreaterThan(auth);
      expect(spend, `${fn} ${marker}`).toBeGreaterThan(charge);
      expect(h.slice(charge, charge + 300)).toContain(`"${fn}"`);
      expect(h).toContain("if (limited) return limited;");
      // Exactly one charge per request path.
      expect(h.split("chargeDailyLimit(").length - 1, fn).toBe(1);
    });
  }

  it("the per-user charge uses the service client, never the caller's", () => {
    for (const fn of Object.keys(PROVIDER_MARKER)) {
      const h = handler(fn);
      // The call's own arguments only — the next statement may name `db`.
      const start = h.indexOf("chargeDailyLimit(");
      const call = h.slice(start, h.indexOf(");", start));
      expect(call, fn).toMatch(/SERVICE_ROLE_KEY|serviceClient|dbService/);
      expect(call, fn).not.toMatch(/userClient|\bdb\b,|ANON_KEY/);
    }
  });

  it("video-studio charges only job submission — poll, cancel and delete stay free", () => {
    const h = handler("video-studio");
    const generate = h.indexOf('case "generate"');
    const poll = h.indexOf('case "poll"');
    const charge = h.indexOf("chargeDailyLimit(");
    expect(charge).toBeGreaterThan(generate);
    expect(charge).toBeLessThan(poll);
  });

  it("image-tools-generate charges only starting a job — polling stays free", () => {
    const h = handler("image-tools-generate");
    const pollBranch = h.indexOf('body.action === "poll"');
    const startJob = h.indexOf("// ── Start a new job");
    expect(pollBranch).toBeGreaterThan(0);
    expect(h.indexOf("chargeDailyLimit(")).toBeGreaterThan(startJob);
  });

  it("the Media Studio functions still check the plan before charging", () => {
    for (const fn of ["image-generate", "image-tools-generate", "video-studio"]) {
      const h = handler(fn);
      expect(h.indexOf("maySeeSection("), fn).toBeLessThan(h.indexOf("chargeDailyLimit("));
    }
  });

  it("moderate-content stays uncharged: moderation is free and guards children's chat", () => {
    expect(src("moderate-content")).not.toContain("chargeDailyLimit");
  });
});
