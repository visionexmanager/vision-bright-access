import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { downloadMedia } from "../../supabase/functions/_shared/whatsappMedia";
import { DOC_CONVERT_MIMES } from "../../supabase/functions/_shared/whatsappDocConvert";

const descriptor = (mimeType: string) => ({
  url: "https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=1",
  mimeType,
  fileSize: 10,
});

afterEach(() => vi.unstubAllGlobals());

describe("downloading the source of a document conversion", () => {
  it("refused a PDF as a video, which is how every PDF to Word job used to fail", async () => {
    const result = await downloadMedia({ mediaId: "1", kind: "video", token: "t", descriptor: descriptor("application/pdf") });
    expect(result).toEqual({ ok: false, reason: "unsupported_type" });
  });

  it("accepts the formats the engine converts when a job names them", async () => {
    vi.stubGlobal("fetch", async () => new Response(new Uint8Array([1, 2, 3])));
    for (const mime of ["application/pdf", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream"]) {
      const result = await downloadMedia({
        mediaId: "1", kind: "document", extraMimes: DOC_CONVERT_MIMES, token: "t", descriptor: descriptor(mime),
      });
      expect(result.ok, mime).toBe(true);
    }
  });

  it("keeps the narrow list for everything that does not ask for more", async () => {
    const result = await downloadMedia({
      mediaId: "1", kind: "document", token: "t",
      descriptor: descriptor("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    });
    expect(result).toEqual({ ok: false, reason: "unsupported_type" });
  });
});

describe("the worker answers the job's owner", () => {
  const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
  const drain = webhook.slice(webhook.indexOf("const drainOneMediaJob"), webhook.indexOf("const drainOneMediaJob") + 9000);

  it("looks the recipient up when the claimed job belongs to another conversation", () => {
    expect(drain).toContain("job.conversation_id !== conversationId");
    expect(drain).toContain("wa_phone");
  });

  it("never sends to the sender of the message that happened to drain the queue", () => {
    expect(drain.slice(drain.indexOf("let jobTo")).match(/to: incoming\.from/g)?.length ?? 0).toBe(0);
  });
});

import { asksAboutFile } from "../../supabase/functions/_shared/whatsappMediaJobs";

describe("asking where a converted file has got to", () => {
  it("reads the questions people actually type", () => {
    for (const text of ["وين صار الملف", "وين الملف", "لسا ما وصل التحويل", "شو صار بالتحويل؟", "where is my file", "is the word file ready?", "still not received the file"]) {
      expect(asksAboutFile(text), text).toBe(true);
    }
  });

  it("leaves other messages to the assistant", () => {
    for (const text of ["وين اقرب صيدلية", "ارسل لي الملف", "where is the pharmacy", "حوله الى word", "كيف حالك", "", "x".repeat(200)]) {
      expect(asksAboutFile(text), text).toBe(false);
    }
  });
});
