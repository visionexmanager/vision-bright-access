// Artwork for a social post: the prompt, the generation, and where the file
// lands so Meta can fetch it.
//
// Instagram publishes no text-only post — `createInstagramAdapter` refuses at
// readiness without a media URL — and the content engine produced words and
// nothing else, so every Instagram proposal was a draft that could be approved
// and then refused forever. This is the missing half.
//
// ── Two decisions worth stating ─────────────────────────────────────────────
//
// **No text in the picture.** Image models set Arabic type badly: letters are
// disconnected, diacritics land wrong, and a misspelt word on a company
// account is worse than no word. The hook is the caption, where it is real
// text a screen reader can read — which matters more here than anywhere,
// because the audience for this product is the audience that cannot read an
// image at all.
//
// **The bytes are stored, never the provider's URL.** OpenAI returns base64
// for the current image models and a short-lived link for video; a post
// scheduled for tomorrow would find either gone. The file goes to the public
// `social-media` bucket and the post carries that URL.

import type { ProposalView } from "./ownerContent.ts";

/**
 * The image models this key actually has, in preference order.
 *
 * Verified against the live key on 2026-09-19: `dall-e-3` and `dall-e-2` have
 * been retired and answer "The model 'dall-e-3' does not exist", which is why
 * anything still asking for them generates nothing at all. The list is a
 * fallback chain rather than one name because that is the failure this comment
 * exists to describe, and it will happen again.
 */
export const IMAGE_MODELS = ["gpt-image-1", "gpt-image-1-mini"] as const;

/** Sora, for the vertical clips Instagram calls reels. */
export const VIDEO_MODEL = "sora-2";

/** Seconds of video. Short on purpose: a reel is watched, not sat through. */
export const VIDEO_SECONDS = 8;

/** How long a video job may take before it is abandoned. */
export const VIDEO_TIMEOUT_MS = 8 * 60_000;

export type MediaKind = "image" | "video";

/**
 * The generation key, read here rather than in a handler.
 *
 * The webhook is asserted never to reach for a provider key itself — the
 * shared provider layer owns key handling, and a handler that reads one is a
 * handler that will eventually log one. This file is that layer for pictures
 * and clips, so this is where the read belongs.
 *
 * Guarded, because the same module is imported by the test suite under Node,
 * where `Deno` does not exist.
 */
export function mediaApiKey(): string | undefined {
  // deno-lint-ignore no-explicit-any
  const runtime = (globalThis as any).Deno;
  return typeof runtime?.env?.get === "function"
    ? runtime.env.get("OPENAI_API_KEY") ?? undefined
    : undefined;
}

/**
 * What each content type needs to be publishable.
 *
 * A reel and a short video are video; a post, a carousel and a story are an
 * image. An article is neither — the website has its own art direction.
 */
export function mediaKindFor(contentType: string, platform: string): MediaKind | null {
  if (platform === "facebook") {
    // Facebook publishes text, so art is an improvement rather than a
    // requirement, and this path deliberately does not spend money on one.
    return null;
  }
  if (contentType === "reel" || contentType === "short_video") return "video";
  if (contentType === "post" || contentType === "carousel" || contentType === "story") return "image";
  return null;
}

/** Instagram's shapes: square for the feed, 9:16 for a reel. */
export function mediaSizeFor(kind: MediaKind, contentType: string): string {
  if (kind === "video") return "720x1280";
  return contentType === "story" ? "1024x1536" : "1024x1024";
}

// ── The prompt ───────────────────────────────────────────────────────────────

/**
 * Visionex's look, stated once.
 *
 * High contrast and a clear focal point are not decoration here: a
 * low-vision viewer scrolling a feed gets one second and a small screen, and
 * a busy pastel illustration is invisible to them.
 */
const HOUSE_STYLE = [
  "Modern flat vector illustration, clean geometric shapes, generous negative space.",
  "Deep teal and warm amber on a light neutral background, high contrast, one clear focal subject.",
  "Friendly and optimistic, suitable for an education and accessibility brand.",
  "No text, no letters, no numbers, no logos, no watermarks anywhere in the image.",
  "No real people's faces.",
].join(" ");

const SECTION_SUBJECT: Record<string, string> = {
  academy_courses: "learning and teaching — an open book, a lightbulb, a graduation cap",
  products: "a marketplace — shopping bags, a storefront, everyday goods",
  services: "helpful services — hands offering support, tools, a service desk",
  kids_games: "playful children's learning — building blocks, friendly rounded shapes, toys",
  content_items: "reading and ideas — articles, a magazine, a quill",
  simulations: "experiments and discovery — a beaker, gears, a science lab",
  tv_channels: "watching television — a screen, a broadcast tower, a remote",
  radio_stations: "listening — a radio, sound waves, headphones",
  communities: "people together — a circle of abstract figures, speech bubbles",
  events: "an event — a calendar, a stage, a ticket",
  jobs: "work and careers — a briefcase, a CV, a handshake",
};

/**
 * One prompt from one proposal.
 *
 * The topic leads, because that is what makes two posts look different from
 * each other; the section supplies the subject matter when the topic is thin;
 * the house style closes, because the last instruction is the one these models
 * weight most.
 *
 * Deliberately built from `topic` and `hook` and not from `body` or
 * `rationale`: `rationale` carries the engine's internal sourcing notes, and
 * nothing internal should reach a third party's prompt.
 */
export function buildMediaPrompt(proposal: ProposalView, kind: MediaKind): string {
  const subject = SECTION_SUBJECT[proposal.section] ?? "learning, technology and everyday life";
  const topic = (proposal.topic || proposal.hook || "").trim().slice(0, 300);

  const motion = kind === "video"
    ? "Slow, calm camera motion and one simple animated element; nothing flashing, strobing or rapidly moving."
    : "";

  return [
    `A ${kind === "video" ? "short vertical video" : "single illustration"} about: ${topic}.`,
    `Visual subject: ${subject}.`,
    HOUSE_STYLE,
    motion,
  ].filter(Boolean).join(" ").slice(0, 3_000);
}

// ── Talking to the provider ──────────────────────────────────────────────────

export type MediaFetch = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string | FormData },
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  arrayBuffer(): Promise<ArrayBuffer>;
}>;

export interface MediaDeps {
  apiKey: string;
  fetchImpl: MediaFetch;
  /** Store the bytes and hand back a URL anyone can fetch. */
  upload(path: string, bytes: Uint8Array, contentType: string): Promise<string | null>;
  now?: () => number;
  /** Test seam: the poll interval while a video renders. */
  sleep?: (ms: number) => Promise<void>;
  /**
   * Told what the provider did, once per generation — never the prompt, the
   * bytes or a provider's sentence, only the short code. Optional and
   * best-effort: a recorder that throws changes nothing about the result
   * (Phase 2H; see providerRecording.ts).
   */
  record?: (outcome: MediaOutcome) => Promise<void>;
}

/** What one generation told the provider registry. */
export interface MediaOutcome {
  kind: MediaKind;
  /** The provider produced the media — whether or not storing it then worked. */
  success: boolean;
  ms: number;
  /** A short code from `classify` and friends, only when `success` is false. */
  error?: string;
}

async function report(deps: MediaDeps, outcome: MediaOutcome): Promise<void> {
  if (!deps.record) return;
  try {
    await deps.record(outcome);
  } catch {
    // Recording is never allowed to cost the caller its picture.
  }
}

export interface MediaResult {
  ok: boolean;
  kind?: MediaKind;
  url?: string;
  prompt?: string;
  /** A short code, never a provider's sentence. */
  error?: string;
}

const OPENAI = "https://api.openai.com/v1";

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Read a provider answer without keeping its text.
 *
 * An OpenAI error quotes the failing request, and the failing request carries
 * the key — so nothing from the body is returned, only a code chosen from the
 * status. The one exception is a content-policy refusal, which is worth
 * telling apart because the fix is to change the prompt rather than to retry.
 */
async function classify(status: number, body: unknown): Promise<string> {
  const error = (body as { error?: { code?: string; type?: string } } | null)?.error;
  const code = error?.code ?? error?.type ?? "";
  if (/content_policy|moderation|safety/i.test(code)) return "content_policy";
  if (/does not exist|model_not_found/i.test(code)) return "model_unavailable";
  if (status === 401 || status === 403) return "key_rejected";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "provider_unavailable";
  return "provider_rejected";
}

/** One picture, stored, with a URL Meta can fetch. */
export async function generateImage(
  deps: MediaDeps,
  prompt: string,
  size: string,
  pathPrefix: string,
): Promise<MediaResult> {
  const now = deps.now ?? (() => Date.now());
  const started = now();
  // Every exit reports once: `providerOk` is whether the provider produced a
  // picture, so a storage failure is not held against the provider.
  const done = async (result: MediaResult, providerOk: boolean): Promise<MediaResult> => {
    await report(deps, {
      kind: "image",
      success: providerOk,
      ms: now() - started,
      error: providerOk ? undefined : result.error,
    });
    return result;
  };
  let lastError = "provider_rejected";

  for (const model of IMAGE_MODELS) {
    let response;
    try {
      response = await deps.fetchImpl(`${OPENAI}/images/generations`, {
        method: "POST",
        headers: { Authorization: `Bearer ${deps.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt, size, n: 1 }),
      });
    } catch {
      return done({ ok: false, error: "provider_unreachable" }, false);
    }

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      lastError = await classify(response.status, payload);
      // Only a missing model is worth trying the next name for. A rejected key
      // or a policy refusal would answer identically every time, and asking
      // again is a second charge for the same answer.
      if (lastError === "model_unavailable") continue;
      return done({ ok: false, error: lastError }, false);
    }

    const first = (payload as { data?: Array<{ b64_json?: string; url?: string }> } | null)?.data?.[0];
    if (!first?.b64_json) {
      // The current models answer in base64 and never with a link. A link here
      // would mean the API changed shape, which is worth failing loudly for
      // rather than storing a URL that expires within the hour.
      return done({ ok: false, error: first?.url ? "unexpected_url_response" : "no_image_returned" }, false);
    }

    const url = await deps.upload(`${pathPrefix}.png`, decodeBase64(first.b64_json), "image/png");
    return done(url ? { ok: true, kind: "image", url, prompt } : { ok: false, error: "upload_failed" }, true);
  }

  return done({ ok: false, error: lastError }, false);
}

/**
 * One short vertical video, stored.
 *
 * Three steps, because the API is asynchronous: create the job, poll it, then
 * download the finished file. The poll is a read of a status field, not a
 * retry — nothing is created twice by asking again — and it is bounded, so a
 * job that never finishes costs a timeout rather than an invocation.
 */
export async function generateVideo(
  deps: MediaDeps,
  prompt: string,
  size: string,
  pathPrefix: string,
): Promise<MediaResult> {
  const now = deps.now ?? (() => Date.now());
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const started = now();
  // Every exit reports once, as generateImage's do (Phase 2J-0): `providerOk`
  // is whether Sora produced the clip, so a storage failure is not held
  // against it.
  const done = async (result: MediaResult, providerOk: boolean): Promise<MediaResult> => {
    await report(deps, {
      kind: "video",
      success: providerOk,
      ms: now() - started,
      error: providerOk ? undefined : result.error,
    });
    return result;
  };

  const form = new FormData();
  form.append("model", VIDEO_MODEL);
  form.append("prompt", prompt);
  form.append("size", size);
  form.append("seconds", String(VIDEO_SECONDS));

  let created;
  try {
    created = await deps.fetchImpl(`${OPENAI}/videos`, {
      method: "POST",
      headers: { Authorization: `Bearer ${deps.apiKey}` },
      body: form,
    });
  } catch {
    return done({ ok: false, error: "provider_unreachable" }, false);
  }

  const createdBody = await created.json().catch(() => null);
  if (!created.ok) return done({ ok: false, error: await classify(created.status, createdBody) }, false);

  const id = (createdBody as { id?: string } | null)?.id;
  if (!id) return done({ ok: false, error: "no_job_returned" }, false);

  const deadline = now() + VIDEO_TIMEOUT_MS;
  let state = "queued";
  while (state !== "completed" && state !== "failed" && now() < deadline) {
    await sleep(Math.min(15_000, Math.max(0, deadline - now())));
    let polled;
    try {
      polled = await deps.fetchImpl(`${OPENAI}/videos/${id}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${deps.apiKey}` },
      });
    } catch {
      return done({ ok: false, error: "provider_unreachable" }, false);
    }
    const body = await polled.json().catch(() => null);
    if (!polled.ok) return done({ ok: false, error: await classify(polled.status, body) }, false);
    state = (body as { status?: string } | null)?.status ?? "failed";
  }

  if (state !== "completed") {
    return done({ ok: false, error: state === "failed" ? "video_failed" : "video_timeout" }, false);
  }

  let content;
  try {
    content = await deps.fetchImpl(`${OPENAI}/videos/${id}/content`, {
      method: "GET",
      headers: { Authorization: `Bearer ${deps.apiKey}` },
    });
  } catch {
    return done({ ok: false, error: "provider_unreachable" }, false);
  }
  if (!content.ok) return done({ ok: false, error: "video_download_failed" }, false);

  const bytes = new Uint8Array(await content.arrayBuffer());
  if (bytes.byteLength === 0) return done({ ok: false, error: "video_download_failed" }, false);

  const url = await deps.upload(`${pathPrefix}.mp4`, bytes, "video/mp4");
  return done(url ? { ok: true, kind: "video", url, prompt } : { ok: false, error: "upload_failed" }, true);
}

/** The whole thing, for one proposal: decide, prompt, generate, store. */
export async function generateProposalMedia(
  deps: MediaDeps,
  proposal: ProposalView,
  force?: MediaKind,
): Promise<MediaResult> {
  const kind = force ?? mediaKindFor(proposal.content_type, proposal.platform);
  if (!kind) return { ok: false, error: "no_media_needed" };
  if (!deps.apiKey) return { ok: false, error: "no_api_key" };

  const prompt = buildMediaPrompt(proposal, kind);
  const size = mediaSizeFor(kind, proposal.content_type);
  // The reference, the kind and the minute: a regeneration writes a new file
  // rather than replacing one a scheduled post may already be pointing at.
  const path = `${proposal.proposal_ref}/${kind}-${Date.now()}`;

  return kind === "video"
    ? await generateVideo(deps, prompt, size, path)
    : await generateImage(deps, prompt, size, path);
}

/** Why it did not work, in words the owner can act on. */
export const MEDIA_ERROR_AR: Record<string, string> = {
  no_api_key: "مفتاح التوليد غير مضبوط على الخادم.",
  no_media_needed: "هذا النوع من المنشورات لا يحتاج صورة.",
  content_policy: "رُفض الوصف لأسباب تتعلق بسياسة المحتوى. جرّب /again لصياغة أخرى.",
  model_unavailable: "نموذج التوليد غير متاح على هذا المفتاح.",
  key_rejected: "مفتاح التوليد مرفوض — يحتاج تحديثاً على الخادم.",
  rate_limited: "المزوّد يطلب التمهّل. جرّب بعد قليل.",
  provider_unavailable: "خدمة التوليد غير متاحة الآن. جرّب بعد قليل.",
  provider_unreachable: "تعذّر الوصول إلى خدمة التوليد.",
  upload_failed: "تولّدت الصورة لكن تعذّر حفظها.",
  video_timeout: "الفيديو استغرق وقتاً أطول من المسموح. جرّب مرة أخرى.",
  video_failed: "تعذّر إنتاج الفيديو. جرّب /video مرة أخرى.",
  video_download_failed: "جهز الفيديو لكن تعذّر تنزيله.",
  no_image_returned: "لم يُرجع المزوّد صورة.",
};

export function explainMediaFailure(code: string | undefined): string {
  return MEDIA_ERROR_AR[code ?? ""] ?? "تعذّر توليد الصورة الآن. جرّب بعد قليل.";
}
