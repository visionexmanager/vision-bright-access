// Artwork for a social post: what is asked for, what comes back, and where it
// is kept.
//
// Instagram publishes no text-only post, so before this existed every
// Instagram proposal the daily run made was a draft that could be approved,
// scheduled, and then refused forever with `media_required`.

import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import {
  buildMediaPrompt,
  explainMediaFailure,
  generateImage,
  generateVideo,
  IMAGE_MODELS,
  mediaKindFor,
  mediaSizeFor,
  VIDEO_MODEL,
} from "../../supabase/functions/_shared/contentMedia.ts";
import {
  dailyBriefs,
  formatProposalMessage,
  parseContentCommand,
} from "../../supabase/functions/_shared/ownerContent.ts";

const migration = readFileSync("supabase/migrations/20261021000000_content_media.sql", "utf8");
const adapters = readFileSync("supabase/functions/_shared/publishing/metaAdapters.ts", "utf8");
const worker = readFileSync("supabase/functions/social-publish/index.ts", "utf8");
const studio = readFileSync("supabase/functions/image-generate/index.ts", "utf8");

const proposal = {
  proposal_ref: "AB2CD", platform: "instagram", section: "academy_courses", content_type: "post",
  topic: "دورة جديدة في القراءة بالصوت", hook: "تعلّم بلا حدود", body: "نص المنشور",
  hashtags: [], rationale: "SOURCED FROM internal catalogue row 4417", state: "PROPOSED",
  proposed_publish_at: null,
};

/** A fetch that answers a scripted queue, and records what it was asked. */
function scriptedFetch(steps: Array<{ ok?: boolean; status?: number; body?: unknown; bytes?: number }>) {
  const calls: Array<{ url: string; method: string; body: unknown }> = [];
  const impl = (url: string, init?: { method?: string; body?: unknown }) => {
    const step = steps.shift() ?? { ok: false, status: 500, body: {} };
    calls.push({ url, method: init?.method ?? "GET", body: init?.body });
    return Promise.resolve({
      ok: step.ok ?? true,
      status: step.status ?? (step.ok === false ? 400 : 200),
      json: () => Promise.resolve(step.body ?? {}),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(step.bytes ?? 8)),
    });
  };
  return { impl, calls };
}

/** One pixel of PNG, base64 — enough to prove the decode and the hand-off. */
const ONE_PIXEL = "iVBORw0KGgo=";

describe("what a proposal needs before it can be published", () => {
  it("asks for the shape each content type actually is", () => {
    expect(mediaKindFor("post", "instagram")).toBe("image");
    expect(mediaKindFor("carousel", "instagram")).toBe("image");
    expect(mediaKindFor("reel", "instagram")).toBe("video");
    expect(mediaKindFor("short_video", "instagram")).toBe("video");
    // Facebook publishes text, so nothing is spent on art it does not need.
    expect(mediaKindFor("post", "facebook")).toBeNull();
    expect(mediaKindFor("article", "website")).toBeNull();
  });

  it("uses the shape each surface expects", () => {
    expect(mediaSizeFor("image", "post")).toBe("1024x1024");
    expect(mediaSizeFor("image", "story")).toBe("1024x1536");
    // Vertical, because a reel is watched on a phone held upright.
    expect(mediaSizeFor("video", "reel")).toBe("720x1280");
  });

  it("proposes only shapes the pipeline can finish", () => {
    // A carousel needs several images the adapter cannot send, and a reel
    // needs a render longer than one daily invocation should hold open.
    for (let day = 0; day < 10; day++) {
      for (const brief of dailyBriefs(new Date(Date.UTC(2026, 8, 1 + day)), 2)) {
        expect(brief.contentType, `${brief.platform} ${brief.contentType}`).toBe("post");
      }
    }
  });
});

describe("the prompt", () => {
  it("carries the topic and the section's subject matter", () => {
    const prompt = buildMediaPrompt(proposal, "image");
    expect(prompt).toContain("دورة جديدة في القراءة بالصوت");
    expect(prompt).toContain("open book");
  });

  it("never carries the engine's own notes to a third party", () => {
    // `rationale` holds the internal sourcing detail the content engine is
    // specifically built never to leak; `body` is the post, not a brief.
    const prompt = buildMediaPrompt(proposal, "image");
    expect(prompt).not.toContain("SOURCED FROM");
    expect(prompt).not.toContain("4417");
    expect(prompt).not.toContain("نص المنشور");
  });

  it("forbids text in the picture, because these models set Arabic badly", () => {
    const prompt = buildMediaPrompt(proposal, "image");
    expect(prompt).toContain("No text");
    expect(prompt).toContain("high contrast");
  });

  it("asks a video for calm motion rather than flashing", () => {
    const prompt = buildMediaPrompt(proposal, "video");
    expect(prompt).toContain("vertical video");
    expect(prompt).toMatch(/nothing flashing|strobing/);
  });
});

describe("generating a picture", () => {
  it("stores the bytes and hands back the stored URL", async () => {
    const { impl, calls } = scriptedFetch([{ body: { data: [{ b64_json: ONE_PIXEL }] } }]);
    const upload = vi.fn(async () => "https://cdn.visionex.app/social-media/AB2CD/image-1.png");
    const result = await generateImage(
      { apiKey: "k", fetchImpl: impl, upload }, "a prompt", "1024x1024", "AB2CD/image-1",
    );

    expect(result.ok).toBe(true);
    expect(result.url).toBe("https://cdn.visionex.app/social-media/AB2CD/image-1.png");
    expect(upload).toHaveBeenCalledWith("AB2CD/image-1.png", expect.any(Uint8Array), "image/png");
    // The key goes in the header, never in a query string.
    expect(calls[0].url).not.toContain("k");
    expect(JSON.parse(calls[0].body as string).model).toBe(IMAGE_MODELS[0]);
  });

  it("tries the next model when one does not exist, and only then", async () => {
    // The exact failure that killed image-generate: a retired model name.
    const missing = { ok: false, status: 400, body: { error: { code: "model_not_found" } } };
    const { impl, calls } = scriptedFetch([missing, { body: { data: [{ b64_json: ONE_PIXEL }] } }]);
    const result = await generateImage(
      { apiKey: "k", fetchImpl: impl, upload: async () => "https://x/y.png" }, "p", "1024x1024", "p1",
    );
    expect(result.ok).toBe(true);
    expect(JSON.parse(calls[1].body as string).model).toBe(IMAGE_MODELS[1]);

    // A policy refusal would answer identically every time, so asking again is
    // a second charge for the same answer.
    const refused = scriptedFetch([{ ok: false, status: 400, body: { error: { code: "content_policy_violation" } } }]);
    const second = await generateImage(
      { apiKey: "k", fetchImpl: refused.impl, upload: async () => "https://x/y.png" }, "p", "1024x1024", "p1",
    );
    expect(second).toEqual({ ok: false, error: "content_policy" });
    expect(refused.calls).toHaveLength(1);
  });

  it("refuses a provider URL rather than storing something that expires", async () => {
    const { impl } = scriptedFetch([{ body: { data: [{ url: "https://oaidalleapi.../x.png" }] } }]);
    const result = await generateImage(
      { apiKey: "k", fetchImpl: impl, upload: async () => "https://x/y.png" }, "p", "1024x1024", "p1",
    );
    expect(result).toEqual({ ok: false, error: "unexpected_url_response" });
  });

  it("says so when the bytes arrived but could not be kept", async () => {
    const { impl } = scriptedFetch([{ body: { data: [{ b64_json: ONE_PIXEL }] } }]);
    const result = await generateImage(
      { apiKey: "k", fetchImpl: impl, upload: async () => null }, "p", "1024x1024", "p1",
    );
    expect(result).toEqual({ ok: false, error: "upload_failed" });
  });

  it("never returns the provider's sentence, which quotes the request", async () => {
    const { impl } = scriptedFetch([{
      ok: false, status: 401,
      body: { error: { message: "Incorrect API key provided: sk-proj-ABC123..." } },
    }]);
    const result = await generateImage(
      { apiKey: "k", fetchImpl: impl, upload: async () => "https://x/y.png" }, "p", "1024x1024", "p1",
    );
    expect(result.error).toBe("key_rejected");
    expect(JSON.stringify(result)).not.toContain("sk-proj");
  });
});

describe("generating a clip", () => {
  const noSleep = { sleep: async () => {} };

  it("creates, polls, downloads and stores", async () => {
    const { impl, calls } = scriptedFetch([
      { body: { id: "video_1", status: "queued" } },
      { body: { status: "in_progress" } },
      { body: { status: "completed" } },
      { bytes: 2048 },
    ]);
    const upload = vi.fn(async () => "https://cdn.visionex.app/social-media/AB2CD/video-1.mp4");
    const result = await generateVideo(
      { apiKey: "k", fetchImpl: impl, upload, ...noSleep }, "p", "720x1280", "AB2CD/video-1",
    );

    expect(result).toMatchObject({ ok: true, kind: "video" });
    expect(upload).toHaveBeenCalledWith("AB2CD/video-1.mp4", expect.any(Uint8Array), "video/mp4");
    expect(calls[0].url).toMatch(/\/videos$/);
    expect(calls[3].url).toMatch(/\/videos\/video_1\/content$/);
    // Polling reads a status; it never creates a second job.
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(1);
  });

  it("gives up rather than waiting forever, and says which it was", async () => {
    const stuck = () => ({ body: { status: "in_progress" } });
    const { impl } = scriptedFetch([{ body: { id: "v", status: "queued" } }, ...Array.from({ length: 50 }, stuck)]);
    let clock = 0;
    const result = await generateVideo(
      { apiKey: "k", fetchImpl: impl, upload: async () => "u", sleep: async () => { clock += 60_000; }, now: () => clock },
      "p", "720x1280", "p1",
    );
    expect(result).toEqual({ ok: false, error: "video_timeout" });

    const failed = scriptedFetch([{ body: { id: "v", status: "queued" } }, { body: { status: "failed" } }]);
    expect(await generateVideo(
      { apiKey: "k", fetchImpl: failed.impl, upload: async () => "u", ...noSleep }, "p", "720x1280", "p1",
    )).toEqual({ ok: false, error: "video_failed" });
  });

  it("asks for the model this account actually has", () => {
    expect(VIDEO_MODEL).toBe("sora-2");
  });
});

describe("every failure has a sentence the owner can act on", () => {
  it("names the next move, never a provider string", () => {
    expect(explainMediaFailure("content_policy")).toContain("/again");
    expect(explainMediaFailure("key_rejected")).toContain("الخادم");
    expect(explainMediaFailure("video_timeout")).toContain("مرة أخرى");
    // An unknown code still gets a sentence rather than an empty message.
    expect(explainMediaFailure("something_new")).not.toBe("");
    expect(explainMediaFailure(undefined)).not.toBe("");
  });
});

describe("the publisher sends what was generated", () => {
  it("posts a clip as a reel and a picture as a picture", () => {
    expect(adapters).toContain('media_type: "REELS", video_url: request.mediaUrl!');
    expect(adapters).toContain("image_url: request.mediaUrl!");
    // Decided by the recorded kind, not by guessing from the URL, because a
    // storage URL need not carry an extension.
    expect(adapters).toContain('request.mediaKind === "video"');
    // A clip is transcoded by Meta and one minute is not enough for it.
    expect(adapters).toMatch(/mediaKind === "video" \? 300_000 : 60_000/);
  });

  it("carries the kind from the claim, not from the file name", () => {
    expect(worker).toContain('row.media_kind === "video" || row.media_kind === "image"');
  });
});

describe("the migration", () => {
  it("puts the art somewhere Meta can fetch it, and nothing else there", () => {
    expect(migration).toContain("'social-media'");
    expect(migration).toMatch(/INSERT INTO storage\.buckets[\s\S]{0,200}true,/);
    // Read by anyone; no INSERT, UPDATE or DELETE policy anywhere.
    expect(migration).toContain("ON storage.objects FOR SELECT");
    expect(migration).not.toMatch(/ON storage\.objects FOR (INSERT|UPDATE|DELETE|ALL)/);
  });

  it("keeps the write path a function, like every other write in this area", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.record_content_proposal_media");
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.record_content_proposal_media(text, text, text, text)\n  FROM PUBLIC, anon, authenticated;");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.record_content_proposal_media(text, text, text, text) TO service_role;");
    expect(migration).toContain("'already_published'");
  });

  it("hands the worker the media with the claim", () => {
    expect(migration).toContain("'media_url', _proposal.media_url");
    expect(migration).toContain("'media_kind', _proposal.media_kind");
    // And the claim is still the same claim: the connection predicate and the
    // withheld-slot accounting were re-declared, not dropped.
    expect(migration).toContain("public.social_account_has_live_grant(a.id))");
    expect(migration).toContain("'withheld_for_connection', _withheld");
    expect(migration).toContain("FOR UPDATE OF s SKIP LOCKED");
  });

  it("adds to the payload without dropping anything from it", () => {
    // A full restatement is the only way to change a payload, and it is also
    // the only way to lose a field from one by accident. Every key the previous
    // definition returned must still be here.
    const previous = readFileSync("supabase/migrations/20260911000000_social_claim_requires_connection.sql", "utf8");
    const keysOf = (sql: string) => {
      // Anchored loosely on purpose: these files are checked out with CRLF.
      const at = sql.search(/RETURN jsonb_build_object\(\s*'ok', true,\s*'publication_id'/);
      return at < 0 ? [] : [...sql.slice(at).matchAll(/'([a-z_]+)',/g)].map((m) => m[1]);
    };
    const before = keysOf(previous);
    expect(before.length).toBeGreaterThan(10);
    for (const key of before) expect(keysOf(migration), key).toContain(key);
  });
});

describe("the image studio asks for a model that exists", () => {
  it("no longer names a retired family anywhere it matters", () => {
    // The whole studio was answering "The model 'dall-e-3' does not exist".
    expect(studio).toContain('const IMAGE_MODELS = ["gpt-image-1", "gpt-image-1-mini"] as const;');
    expect(studio).not.toMatch(/model:\s*["']dall-e/);
    // In the request itself, not in the comment explaining why it is gone:
    // this family answers in base64 whatever is asked, and reading `.url`
    // produced nothing even where the call succeeded.
    const from = studio.indexOf("body: JSON.stringify({");
    const sent = studio.slice(from, studio.indexOf("}),", from));
    expect(from).toBeGreaterThan(0);
    expect(sent).not.toContain("response_format");
    expect(sent).not.toContain("style");
    expect(studio).toContain("image.b64_json");
  });

  it("keeps the bytes rather than a link that expires within the hour", () => {
    expect(studio).toContain('.from("image-outputs")');
    expect(studio).toContain("createSignedUrl");
    expect(studio).not.toContain("result.imageUrl");
  });

  it("translates the old vocabulary instead of refusing it", () => {
    expect(studio).toContain("function normaliseSize");
    expect(studio).toContain("function normaliseQuality");
    // `style` is recorded but never sent: this family rejects it outright.
    expect(studio).not.toMatch(/body: JSON\.stringify\(\{[\s\S]{0,200}style/);
  });
});

// ── Asking for artwork from a phone ─────────────────────────────────────────

describe("the owner's /image and /video", () => {
  const ownerContent = readFileSync("supabase/functions/_shared/ownerContent.ts", "utf8");
  const actions = readFileSync("supabase/functions/_shared/ownerContentActions.ts", "utf8");
  const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");

  it("reads both words, in Arabic and English", () => {
    expect(parseContentCommand("image AB2CD")).toEqual({ kind: "media", ref: "AB2CD", media: "image" });
    expect(parseContentCommand("صورة ab2cd")).toEqual({ kind: "media", ref: "AB2CD", media: "image" });
    expect(parseContentCommand("video AB2CD")).toEqual({ kind: "media", ref: "AB2CD", media: "video" });
    expect(parseContentCommand("فيديو AB2CD")).toEqual({ kind: "media", ref: "AB2CD", media: "video" });
    expect(parseContentCommand("image")).toEqual({ kind: "needs_reference", verb: "image" });
  });

  it("answers first and renders afterwards", () => {
    // A picture takes fifteen seconds and a clip a couple of minutes. Awaiting
    // either inside the webhook leaves the owner with no reply while Meta
    // retries the same delivery.
    expect(actions).toContain("context.background(");
    expect(webhook).toContain("background: (work) => EdgeRuntime.waitUntil(work)");
    // The webhook reaches for no provider key: contentMedia.mediaApiKey() is
    // the shared layer that owns that read.
    expect(webhook).not.toMatch(/Deno\.env\.get\(\s*["']OPENAI_API_KEY/);
    expect(actions).toContain("context.openAiKey ?? mediaApiKey()");
    // Without a way to hand work off it says so rather than blocking.
    expect(actions).toContain('if (!context.background) return "تعذّر بدء التوليد الآن. جرّب بعد قليل.";');
  });

  it("sends the picture itself, with a caption, and falls back to the link", () => {
    // A picture with no caption is nothing at all to a screen reader.
    expect(actions).toContain("sendWhatsAppMediaByLink(");
    expect(actions).toMatch(/caption: `\$\{noun\} \$\{ref\}/);
    expect(actions).toContain("if (!sent) await tell(");
  });

  it("shows on the proposal whether there is artwork yet", () => {
    const withArt = formatProposalMessage({ ...proposal, media_kind: "image", media_url: "https://x/y.png" });
    expect(withArt).toContain("صورة جاهزة");
    expect(withArt).toContain("/image AB2CD");
    const without = formatProposalMessage(proposal);
    expect(without).toContain("لا ينشر نصاً بلا صورة");
    expect(without).toContain("/video AB2CD");
  });

  it("keeps the generated file out of reach of a published post", () => {
    // record_content_proposal_media refuses a PUBLISHED proposal, and the
    // command refuses before even starting the render.
    expect(actions).toContain('if (proposal.state === "PUBLISHED")');
    expect(ownerContent).toContain("/image AB2CD — صورة للمنشور");
  });
});
