// `fetch`, metered: a drop-in for the provider calls that do not go through
// aiProvider.ts — images, speech, transcription, moderation, and the functions
// that call OpenAI directly.
//
// It behaves exactly like fetch for the caller: same request, same Response,
// same errors. On the side it reports one UsageEvent per provider call to
// usageSink.ts: the model from the request, the usage the response carries
// (read from a clone, in the background), and whether it failed.
//
//   /chat/completions        tokens (a stream: include_usage asked for, read
//                            and removed on the way through — streamUsage.ts)
//   /images/generations|edits  text and image tokens, images returned
//   /audio/transcriptions    seconds or tokens, as the provider reports them
//   /audio/speech            characters sent (the tts-1 billing unit); the
//                            audio tokens gpt-4o-mini-tts bills are not
//                            returned, so its cost is left "unpriced", not guessed
//   /embeddings, /moderations  tokens / nothing (moderation is free)
//
// Any other host or path is plain fetch: nothing is read, nothing reported.

import {
  chatUsage,
  embeddingUsage,
  hasUsage,
  imageUsage,
  type MeteredOperation,
  modelIdOf,
  type NormalizedUsage,
  streamUsageFrom,
  transcriptionUsage,
  type UsageEvent,
  utf8Bytes,
} from "./metering.ts";
import { meterSseStream } from "./streamUsage.ts";
import { emitUsage, inBackground } from "./usageSink.ts";

const PROVIDER_HOSTS: Readonly<Record<string, string>> = {
  "api.openai.com": "openai",
  "api.groq.com": "groq",
  "api.mistral.ai": "mistral",
};

/** The providers that send a stream's usage only when asked (see aiProvider.ts). */
const STREAM_USAGE_ON_REQUEST = new Set(["openai", "groq"]);

function operationOf(path: string, stream: boolean): MeteredOperation | null {
  if (/\/chat\/completions$/.test(path)) return stream ? "stream" : "chat";
  if (/\/images\/(generations|edits)$/.test(path)) return "image";
  if (/\/audio\/transcriptions$/.test(path)) return "stt";
  if (/\/audio\/speech$/.test(path)) return "tts";
  if (/\/embeddings$/.test(path)) return "embedding";
  if (/\/moderations$/.test(path)) return "moderation";
  return null;
}

type Body = { json?: Record<string, unknown>; form?: FormData };

function bodyOf(init: RequestInit | undefined): Body {
  const b = init?.body;
  if (typeof b === "string") {
    try {
      const json = JSON.parse(b);
      return json && typeof json === "object" ? { json } : {};
    } catch {
      return {};
    }
  }
  if (b instanceof FormData) return { form: b };
  return {};
}

function modelOf(body: Body): string | undefined {
  return modelIdOf(body.json?.model ?? body.form?.get("model"));
}

function errorCodeOf(status: number): string {
  if ([400, 401, 403, 404, 408, 413, 422, 429].includes(status)) return `http_${status}`;
  return status >= 500 ? "http_5xx" : "http_4xx";
}

function promptBytesOf(json: Record<string, unknown> | undefined): number {
  const messages = Array.isArray(json?.messages) ? json.messages : [];
  let n = 0;
  for (const m of messages) {
    const content = (m as { content?: unknown })?.content;
    if (typeof content === "string") n += utf8Bytes(content);
    else if (Array.isArray(content)) {
      for (const part of content) {
        const text = (part as { text?: unknown })?.text;
        if (typeof text === "string") n += utf8Bytes(text);
      }
    }
  }
  return n;
}

/** The usage a finished, non-streamed response carries, by endpoint. */
async function usageFromResponse(
  op: MeteredOperation,
  res: Response | null,
  body: Body,
): Promise<{ usage?: NormalizedUsage; resolved?: string }> {
  if (op === "tts") {
    const input = body.json?.input;
    return typeof input === "string" ? { usage: { characters: [...input].length } } : {};
  }
  if (!res) return {};
  const json = await res.json().catch(() => null) as Record<string, unknown> | null;
  const resolved = modelIdOf(json?.model);
  const usage = op === "chat" ? chatUsage(json)
    : op === "image" ? imageUsage(json)
    : op === "stt" ? transcriptionUsage(json)
    : op === "embedding" ? embeddingUsage(json)
    : undefined;
  return { usage, resolved };
}

export async function meteredFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  let url: URL;
  try {
    url = new URL(input instanceof Request ? input.url : String(input));
  } catch {
    return fetch(input, init);
  }
  const provider = PROVIDER_HOSTS[url.hostname];
  const body = bodyOf(init);
  const stream = body.json?.stream === true;
  const op = provider ? operationOf(url.pathname, stream) : null;
  const model = modelOf(body);
  if (!provider || !op || !model || input instanceof Request) return fetch(input, init);

  let sendInit = init;
  if (op === "stream" && STREAM_USAGE_ON_REQUEST.has(provider) && body.json && !body.json.stream_options) {
    sendInit = { ...init, body: JSON.stringify({ ...body.json, stream_options: { include_usage: true } }) };
  }

  const base = { operation: op, provider, model } as const;
  let res: Response;
  try {
    res = await fetch(input, sendInit);
  } catch (error) {
    const name = (error as { name?: string })?.name;
    emitUsage({ ...base, outcome: "error", error_code: name === "TimeoutError" || name === "AbortError" ? "timeout" : "network", usage_source: "missing" });
    throw error;
  }

  if (!res.ok) {
    emitUsage({ ...base, outcome: "error", error_code: errorCodeOf(res.status), usage_source: "missing" });
    return res;
  }

  if (op === "stream" && res.body) {
    const promptBytes = promptBytesOf(body.json);
    const metered = meterSseStream(res.body, (seen) => emitUsage({ ...base, ...streamUsageFrom(seen, promptBytes) }));
    return new Response(metered, { status: res.status, statusText: res.statusText, headers: res.headers });
  }

  // Only endpoints whose usage is in a JSON body are read, from a clone; the
  // caller's Response is never touched. Speech is binary and moderation
  // carries no usage, so neither is copied.
  const copy = op === "tts" || op === "moderation" ? null : res.clone();
  inBackground((async () => {
    const { usage, resolved } = await usageFromResponse(op, copy, body);
    const event: UsageEvent = {
      ...base,
      outcome: "ok",
      ...(resolved ? { resolved_model: resolved } : {}),
      ...(hasUsage(usage) ? { usage, usage_source: "reported" } : { usage_source: "missing" }),
    };
    emitUsage(event);
  })());
  return res;
}
