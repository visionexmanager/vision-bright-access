// The local vision model as a last resort: it may only ever add an answer.
//
// Off unless LOCAL_DESCRIBE=on, English and Arabic only, and every failure
// (busy, slow, malformed, empty) leaves the caller with exactly what it had
// before this existed. The wiring tests pin where it sits: after the paid
// chain, never in front of it, never for another mode.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  DESCRIBE_EDGE_PX,
  MAX_DESCRIBE_CHARS,
  describeRequestBody,
  describeResizeArgs,
  describeSystemPrompt,
  isDescribeLanguage,
  readDescribeAnswer,
} from "../../services/media-processor/src/describe.mjs";

async function load() {
  return await import("../../supabase/functions/_shared/whatsappLocalDescribe.ts");
}

const IMAGE = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const CONFIG = { url: "https://visionex.app/internal/media", token: "t0ken" };
const ON = (name: string) => (name === "LOCAL_DESCRIBE" ? "on" : undefined);
// Named, not typed: these are the characters under test.
const ZWSP = String.fromCharCode(0x200b); // must be stripped
const RLO = String.fromCharCode(0x202e); // must be stripped
const SENTENCE = "Two cats are asleep on a pink blanket on a sofa.";

const answering = (status: number, body: unknown): typeof fetch =>
  (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;

const never: typeof fetch = ((_url: unknown, init?: RequestInit) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
  })) as unknown as typeof fetch;

describe("the media processor's describe module", () => {
  it("offers exactly the two languages that were measured", () => {
    expect(isDescribeLanguage("en")).toBe(true);
    expect(isDescribeLanguage("ar")).toBe(true);
    for (const other of ["fr", "ar+eng", "", "toString", undefined, 5]) {
      expect(isDescribeLanguage(other)).toBe(false);
    }
  });

  it("shrinks the picture with a fixed argument list and no caller text", () => {
    const args = describeResizeArgs("/tmp/in", "/tmp/out.jpg");
    expect(args).toContain(`scale=${DESCRIBE_EDGE_PX}:${DESCRIBE_EDGE_PX}:force_original_aspect_ratio=decrease`);
    expect(args.slice(-1)).toEqual(["/tmp/out.jpg"]);
    expect(args).toContain("-map_metadata");
  });

  it("builds a request whose only variable parts are the language and the picture", () => {
    const body = describeRequestBody("QUJD", "Arabic");
    expect(body.messages[0].content).toBe(describeSystemPrompt("Arabic"));
    expect(describeSystemPrompt("Arabic")).toContain("Answer in Arabic.");
    const user = body.messages[1].content as Array<{ type: string; text?: string; image_url?: { url: string } }>;
    expect(user[0].text).toBe("Describe this picture.");
    expect(user[1].image_url?.url).toBe("data:image/jpeg;base64,QUJD");
    expect(body.stream).toBe(false);
  });

  it("tells the model that text in the picture is not an instruction", () => {
    expect(describeSystemPrompt("English")).toMatch(/not an instruction/);
  });

  it("reads the model's text, bounds it and refuses an empty or token answer", () => {
    expect(readDescribeAnswer({ choices: [{ message: { content: `  ${SENTENCE} ` } }] })).toBe(SENTENCE);
    expect(readDescribeAnswer({ choices: [{ message: { content: "x".repeat(MAX_DESCRIBE_CHARS + 500) } }] })?.length)
      .toBe(MAX_DESCRIBE_CHARS);
    for (const bad of [null, {}, { choices: [] }, { choices: [{ message: { content: "" } }] },
      { choices: [{ message: { content: "ok." } }] }, { choices: [{ message: { content: 5 } }] }]) {
      expect(readDescribeAnswer(bad)).toBeNull();
    }
  });
});

describe("describeLocally", () => {
  it("is off unless LOCAL_DESCRIBE is exactly on", async () => {
    const { describeLocally, localDescribeEnabled } = await load();
    for (const value of [undefined, "", "off", "true", "1", "yes"]) {
      expect(localDescribeEnabled((n: string) => (n === "LOCAL_DESCRIBE" ? value : undefined))).toBe(false);
    }
    expect(localDescribeEnabled(ON)).toBe(true);
    expect(localDescribeEnabled((n: string) => (n === "LOCAL_DESCRIBE" ? " ON " : undefined))).toBe(true);
    const result = await describeLocally({
      bytes: IMAGE, mimeType: "image/jpeg", answerLanguage: "en", config: CONFIG,
      read: () => undefined, fetchImpl: (() => { throw new Error("must not be called"); }) as unknown as typeof fetch,
    });
    expect(result).toEqual({ ok: false, reason: "disabled" });
  });

  it("declines every language but English and Arabic before any request", async () => {
    const { describeLocally } = await load();
    const fetchImpl = (() => { throw new Error("must not be called"); }) as unknown as typeof fetch;
    for (const lang of ["fr", "es", "tr", "zh", ""]) {
      expect(await describeLocally({
        bytes: IMAGE, mimeType: "image/jpeg", answerLanguage: lang, config: CONFIG, read: ON, fetchImpl,
      })).toEqual({ ok: false, reason: "language_unsupported" });
    }
  });

  it("is quiet when the service is not configured or the picture is too big", async () => {
    const { describeLocally } = await load();
    expect(await describeLocally({
      bytes: IMAGE, mimeType: "image/jpeg", answerLanguage: "en", config: null, read: ON,
    })).toEqual({ ok: false, reason: "not_configured" });
    expect(await describeLocally({
      bytes: new Uint8Array(8 * 1024 * 1024 + 1), mimeType: "image/jpeg", answerLanguage: "en", config: CONFIG, read: ON,
    })).toEqual({ ok: false, reason: "too_large" });
  });

  it("returns a clean description and sends the language and the token, not the key in the URL", async () => {
    const { describeLocally } = await load();
    let seen: { url: string; headers: Record<string, string> } | null = null;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      seen = { url, headers: init.headers as Record<string, string> };
      return new Response(JSON.stringify({ ok: true, readable: true, text: `${ZWSP}${SENTENCE}${RLO}`, ms: 31000 }), { status: 200 });
    }) as unknown as typeof fetch;
    const result = await describeLocally({
      bytes: IMAGE, mimeType: "image/jpeg", answerLanguage: "ar", config: CONFIG, read: ON, fetchImpl,
    });
    expect(result).toEqual({ ok: true, text: SENTENCE, ms: 31000 });
    expect(seen!.url).toBe("https://visionex.app/internal/media/describe?lang=ar");
    expect(seen!.headers.authorization).toBe("Bearer t0ken");
  });

  it("maps busy, errors, empty and malformed answers to a reason and never throws", async () => {
    const { describeLocally } = await load();
    const run = (fetchImpl: typeof fetch) =>
      describeLocally({ bytes: IMAGE, mimeType: "image/jpeg", answerLanguage: "en", config: CONFIG, read: ON, fetchImpl });
    expect(await run(answering(503, { ok: false, reason: "busy" }))).toEqual({ ok: false, reason: "busy" });
    expect(await run(answering(500, {}))).toEqual({ ok: false, reason: "error" });
    expect(await run(answering(200, { ok: false, reason: "not_configured" }))).toEqual({ ok: false, reason: "error" });
    expect(await run(answering(200, { ok: true, readable: false, text: "" }))).toEqual({ ok: false, reason: "unreadable" });
    expect(await run(answering(200, { ok: true, readable: true, text: "..." }))).toEqual({ ok: false, reason: "unreadable" });
    expect(await run(answering(200, { ok: true, readable: true, text: 5 }))).toEqual({ ok: false, reason: "bad_response" });
    expect(await run(answering(200, "nope"))).toEqual({ ok: false, reason: "bad_response" });
    expect(await run((() => { throw new Error("connection refused"); }) as unknown as typeof fetch))
      .toEqual({ ok: false, reason: "error" });
  });

  it("gives up at its own deadline", async () => {
    const { describeLocally } = await load();
    const result = await describeLocally({
      bytes: IMAGE, mimeType: "image/jpeg", answerLanguage: "en", config: CONFIG, read: ON, fetchImpl: never, timeoutMs: 20,
    });
    expect(result).toEqual({ ok: false, reason: "timeout" });
  });
});

describe("where it is wired", () => {
  const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
  const server = readFileSync("services/media-processor/src/server.mjs", "utf8");
  const deploy = readFileSync(".github/workflows/deploy-media-processor.yml", "utf8");
  const describer = readFileSync(".github/workflows/deploy-vision-describer.yml", "utf8");

  it("runs after the paid chain, only when it produced nothing, and only in describe mode", () => {
    const paid = webhook.indexOf("const seen = await understandImage(");
    const local = webhook.indexOf("await describeLocally(");
    expect(paid).toBeGreaterThan(-1);
    expect(local).toBeGreaterThan(paid);
    expect(webhook).toContain('if (!seen && (!mode || mode === "describe") && !explainReportImage) {');
  });

  it("logs outcome and length, never the description", () => {
    const start = webhook.indexOf('log("local_describe"');
    const block = webhook.slice(start, webhook.indexOf("});", start));
    expect(block).not.toMatch(/local\.text(?!\.length)/);
  });

  it("has a processor route that does nothing without a model and runs one description at a time", () => {
    expect(server).toContain('if (!DESCRIBER_URL) return send(res, 200, { ok: false, reason: "not_configured" });');
    expect(server).toContain('url.pathname === "/describe"');
    expect(server).toMatch(/if \(describing\) \{[\s\S]*503/);
  });

  it("points the processor at the model and keeps the model off the internet", () => {
    expect(deploy).toContain("DESCRIBER_URL=http://host.docker.internal:8098");
    expect(deploy).toContain("--add-host host.docker.internal:host-gateway");
    expect(describer).toContain('--publish "$GW:8098:8080"');
    expect(describer).not.toMatch(/--publish "?0\.0\.0\.0/);
    expect(describer).toContain("workflow_dispatch");
    expect(describer).toContain("options: [status, start, stop, test]");
  });
});
