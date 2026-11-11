// The free week's local lane: allowance, honesty about it, and no paid fallback.

import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { pickTrialFeature, runTrialLane, type TrialLaneDeps } from "../../supabase/functions/_shared/whatsappTrialLane.ts";
import { TRIAL_LANE_STRINGS, trialLaneSay } from "../../supabase/functions/_shared/whatsappTrialLaneStrings.ts";
import { SUPPORTED_LANGUAGES } from "../../supabase/functions/_shared/whatsappLanguages.ts";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const bytes = new Uint8Array([1, 2, 3]);
const okMedia = { ok: true as const, bytes, mimeType: "image/jpeg" };

function lane(take: unknown, over: Partial<TrialLaneDeps> = {}) {
  const calls: { fn: string }[] = [];
  const deps: TrialLaneDeps = {
    rpc: async (fn) => {
      calls.push({ fn });
      return { data: fn === "trial_local_take" ? take : { status: "ok" }, error: null };
    },
    download: vi.fn(async () => okMedia),
    ...over,
  };
  return { deps, calls };
}
const ok = (remaining: number, limit = 10) => ({ status: "ok", limit, used: limit - remaining, remaining });
const run = (deps: TrialLaneDeps, media: Parameters<typeof runTrialLane>[1]["media"], language = "en") =>
  runTrialLane(deps, { waPhone: "96170000001", media, language });

describe("pickTrialFeature", () => {
  it("serves photos, QR/barcode captions and Office documents only", () => {
    expect(pickTrialFeature({ kind: "image" })).toBe("read_text");
    expect(pickTrialFeature({ kind: "image", caption: "اقرأ الباركود" })).toBe("barcode");
    expect(pickTrialFeature({ kind: "image", caption: "scan this QR" })).toBe("barcode");
    expect(pickTrialFeature({ kind: "document", mimeType: DOCX })).toBe("office");
    for (const kind of ["audio", "video", "sticker"] as const) expect(pickTrialFeature({ kind })).toBeNull();
    expect(pickTrialFeature({ kind: "document", mimeType: "application/pdf" })).toBeNull();
    expect(pickTrialFeature(null)).toBeNull();
  });
});

describe("runTrialLane", () => {
  it("reads a photo locally, then states the limit and what is left", async () => {
    const { deps } = lane(ok(7));
    const ocr = vi.fn(async () => ({ ok: true as const, text: "Hello world, this is a sign.", ms: 5 }));
    const out = await run({ ...deps, ocr }, { kind: "image" });
    expect(out.reply).toContain("Hello world, this is a sign.");
    expect(out.reply).toContain("Free week: 7 of 10 photo text readings left.");
  });

  it("says when the allowance has run out, with the limit and the plans link, and does no work", async () => {
    const { deps } = lane({ status: "exhausted", limit: 10, remaining: 0 });
    const out = await run(deps, { kind: "image" });
    expect(out.outcome).toBe("exhausted");
    expect(out.reply).toContain("all 10 free photo text readings");
    expect(out.reply).toContain("https://visionex.app/pricing");
    expect(deps.download).not.toHaveBeenCalled();
  });

  it("is not ours for a number that is not on the free week", async () => {
    const { deps } = lane({ status: "not_trial" });
    expect((await run(deps, { kind: "image" })).handled).toBe(false);
    expect(deps.download).not.toHaveBeenCalled();
  });

  it("hands the unit back and says so when nothing could be read, and never calls a model", async () => {
    const { deps, calls } = lane(ok(9));
    const ocr = vi.fn(async () => ({ ok: false as const, reason: "unreadable" as const }));
    const out = await run({ ...deps, ocr }, { kind: "image" });
    expect(out.reply).toContain("wasn't counted");
    expect(calls.map((c) => c.fn)).toEqual(["trial_local_take", "trial_local_release"]);
    const src = readFileSync("supabase/functions/_shared/whatsappTrialLane.ts", "utf8");
    expect(src).not.toMatch(/askAssistant|understandImage|chainProvider|openai|gemini|streamChat/i);
  });

  it("an unavailable service is refunded and reported as such", async () => {
    const { deps, calls } = lane(ok(9));
    const ocr = vi.fn(async () => ({ ok: false as const, reason: "busy" as const }));
    const out = await run({ ...deps, ocr }, { kind: "image" });
    expect(out.reply).toBe(trialLaneSay("unavailable", "en"));
    expect(calls.at(-1)?.fn).toBe("trial_local_release");
  });

  it("a failed download is refunded", async () => {
    const { deps, calls } = lane(ok(9), { download: async () => ({ ok: false as const, reason: "download_failed" as const }) });
    const out = await run(deps, { kind: "image" });
    expect(out.handled).toBe(true);
    expect(calls.at(-1)?.fn).toBe("trial_local_release");
  });

  it("a language the local reader cannot do is explained before any unit is spent", async () => {
    const { deps, calls } = lane(ok(9));
    const out = await run(deps, { kind: "image" }, "fr");
    expect(out.outcome).toBe("language");
    expect(out.reply).toContain("arabe");
    expect(deps.download).not.toHaveBeenCalled();
    expect(calls.at(-1)?.fn).toBe("trial_local_release");
  });

  it("reads Arabic photos in Arabic", async () => {
    const { deps } = lane(ok(4));
    const ocr = vi.fn(async () => ({ ok: true as const, text: "مرحبا بكم في المكتبة العامة", ms: 5 }));
    const out = await run({ ...deps, ocr }, { kind: "image" }, "ar");
    expect(out.reply).toContain("مرحبا بكم في المكتبة العامة");
    expect(out.reply).toContain("الأسبوع المجاني: بقي لك 4 من 10");
  });

  it("scans a QR code and a product barcode", async () => {
    const { deps } = lane(ok(8));
    const scan = vi.fn(async () => ({
      ok: true as const,
      ms: 3,
      symbols: [
        { symbology: "EAN13", value: "6291041500213", kind: "product" as const },
        { symbology: "QR", value: "https://example.com/menu", kind: "text" as const },
      ],
    }));
    const out = await run({ ...deps, scan }, { kind: "image", caption: "qr" });
    expect(out.reply).toContain("Code: 6291041500213");
    expect(out.reply).toContain("https://example.com/menu");
    expect(out.reply).toContain("8 of 10 code scans left");
  });

  it("reads an Office document, trimmed, with its own smaller allowance", async () => {
    const { deps } = lane(ok(2, 3));
    const office = vi.fn(async () => ({ ok: true as const, text: "x".repeat(9000), parts: 1, ms: 4 }));
    const out = await run({ ...deps, office }, { kind: "document", mimeType: DOCX });
    expect(out.reply!.length).toBeLessThan(3200);
    expect(out.reply).toContain("2 of 3 document readings left");
  });

  it("surfaces a database error instead of answering as if it worked", async () => {
    const deps: TrialLaneDeps = { rpc: async () => ({ data: null, error: new Error("db") }), download: vi.fn() };
    await expect(run(deps, { kind: "image" })).rejects.toBeTruthy();
  });
});

describe("words", () => {
  it("exist in every language with every placeholder the code fills", () => {
    for (const l of SUPPORTED_LANGUAGES) {
      const p = TRIAL_LANE_STRINGS[l];
      for (const [k, v] of Object.entries(p)) expect(v.trim().length, `${l}.${k}`).toBeGreaterThan(1);
      for (const t of ["{left}", "{limit}", "{what}"]) expect(p.note, `${l}.note`).toContain(t);
      for (const t of ["{limit}", "{what}", "{url}"]) expect(p.exhausted, `${l}.exhausted`).toContain(t);
      expect(p.ocrLanguage, `${l}.ocrLanguage`).toContain("{url}");
      expect(p.code, `${l}.code`).toContain("{value}");
    }
  });
});

describe("where the webhook uses it", () => {
  const wa = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
  it("runs only after the gate refused, never for a silenced number, with a token", () => {
    const gate = wa.indexOf("requireActiveSubscription(db, { channel:");
    const call = wa.indexOf("runTrialLane(");
    expect(call).toBeGreaterThan(gate);
    const guard = wa.slice(wa.lastIndexOf("// The free week's local lane", call), call);
    expect(guard).toContain("blocked_first_notice");
    expect(guard).toContain("assistantIsSilenced");
    expect(guard).toContain("incoming.media && token");
  });

  it("the migration keeps the AI gate closed to the free week", () => {
    const sql = readFileSync("supabase/migrations/20261104000300_trial_local_features.sql", "utf8");
    expect(sql).not.toMatch(/CREATE OR REPLACE FUNCTION public\.(ai_eligible_plans|ai_subscription_gate|trial_sections)/);
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION %s TO service_role/);
  });
});

describe("free local photo description", () => {
  const take = (status: string, remaining = 9) => ({ status, limit: 10, used: 10 - remaining, remaining });
  const withRpc = (data: unknown, over: Partial<TrialLaneDeps> = {}) => {
    const calls: string[] = [];
    const deps: TrialLaneDeps = {
      rpc: async (fn) => {
        calls.push(fn);
        return { data: fn === "free_local_describe_take" ? data : { status: "ok" }, error: null };
      },
      download: vi.fn(async () => okMedia),
      ...over,
    };
    return { deps, calls };
  };
  const go = (deps: TrialLaneDeps, caption?: string, describeEnabled = true) =>
    runTrialLane(deps, { waPhone: "96170000001", media: { kind: "image", caption }, language: "en", describeEnabled });

  it("warns that it is slower, describes, and states what is left today", async () => {
    const { deps } = withRpc(take("ok", 7));
    const notify = vi.fn(async (_text: string) => {});
    const describe = vi.fn(async () => ({ ok: true as const, text: "A red car on a street.", ms: 40_000 }));
    const out = await go({ ...deps, notify, describe });
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0]?.[0]).toContain("much faster");
    expect(out.reply).toContain("A red car on a street.");
    expect(out.reply).toContain("7 of 10 descriptions left");
  });

  it("refuses the eleventh, without downloading or describing", async () => {
    const { deps } = withRpc({ status: "exhausted", limit: 10, remaining: 0 });
    const describe = vi.fn();
    const out = await go({ ...deps, describe: describe as never });
    expect(out.outcome).toBe("describe_exhausted");
    expect(out.reply).toContain("all 10 free photo descriptions");
    expect(deps.download).not.toHaveBeenCalled();
    expect(describe).not.toHaveBeenCalled();
  });

  it("hands the unit back when the server could not describe it", async () => {
    const { deps, calls } = withRpc(take("ok"));
    const describe = vi.fn(async () => ({ ok: false as const, reason: "busy" as const }));
    const out = await go({ ...deps, describe });
    expect(out.reply).toContain("wasn't counted");
    expect(calls).toEqual(["free_local_describe_take", "free_local_describe_release"]);
  });

  it("leaves a photo that asks for its text on the OCR, and does nothing when the describer is off", async () => {
    const a = withRpc(take("ok"));
    const ocr = vi.fn(async () => ({ ok: true as const, text: "STOP sign text here", ms: 1 }));
    // OCR path asks the trial allowance, not the describe one.
    const out = await runTrialLane(
      { ...a.deps, ocr, rpc: async (fn) => ({ data: fn === "trial_local_take" ? { status: "ok", limit: 10, remaining: 5 } : {}, error: null }) },
      { waPhone: "1", media: { kind: "image", caption: "read the text" }, language: "en", describeEnabled: true },
    );
    expect(out.outcome).toBe("read_text");
    const calls: string[] = [];
    const off = {
      calls,
      deps: { rpc: async (fn: string) => { calls.push(fn); return { data: { status: "not_trial" }, error: null }; }, download: vi.fn(async () => okMedia) } as TrialLaneDeps,
    };
    expect((await go(off.deps, undefined, false)).handled).toBe(false);
    expect(off.calls).toEqual(["trial_local_take"]);
  });

  it("has all three messages in every language with the placeholders intact", async () => {
    const { FREE_DESCRIBE_STRINGS } = await import("../../supabase/functions/_shared/whatsappFreeDescribeStrings.ts");
    for (const lang of SUPPORTED_LANGUAGES) {
      const p = FREE_DESCRIBE_STRINGS[lang];
      expect(p.wait, lang).toContain("{url}");
      expect(p.note, lang).toContain("{left}");
      expect(p.note, lang).toContain("{limit}");
      expect(p.exhausted, lang).toContain("{limit}");
      expect(p.exhausted, lang).toContain("{url}");
    }
  });

  it("ships the migration with the grant back to service_role", () => {
    const sql = readFileSync("supabase/migrations/20261111000000_free_local_describe_allowance.sql", "utf8");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION %s TO service_role");
    expect(sql).toContain("FROM PUBLIC, anon, authenticated");
    expect(sql).not.toMatch(/CREATE POLICY/i);
  });
});
