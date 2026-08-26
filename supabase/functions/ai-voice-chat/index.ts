import { getCorsHeaders } from "../_shared/cors.ts";
import { synthesize } from "../_shared/voice/tts.ts";
import { guardVoiceRequest, refusalResponse } from "../_shared/voice/guard.ts";
import { getAssistant } from "../_shared/assistants.ts";
import {
  streamChatCompletionWithFallback,
  type ProviderTarget,
} from "../_shared/aiProvider.ts";

async function collectText(stream: ReadableStream<Uint8Array>): Promise<string> {
  const payload = await new Response(stream).text();
  return payload.split("\n").filter((line) => line.startsWith("data:") && !line.includes("[DONE]"))
    .map((line) => {
      try {
        return JSON.parse(line.slice(5).trim()).choices?.[0]?.delta?.content ?? "";
      } catch {
        return "";
      }
    }).join("");
}

const VOICE_PROMPTS: Record<string, string> = {
  visionex: `You are Visionex AI — a warm, expressive voice assistant for Visionex, a global platform that serves everyone. Visionex brings together VXBazaar commerce and digital shops, general and assistive products, Academy learning, courses and articles, professional training, practical simulations for independent projects, career and study guidance, nutrition, emotional support, safe general medical information, legal and technical guidance, marketing, web design, import and purchasing, travel, sports, music, creative services, hair and skin care, specialist AI assistants, image analysis, OCR, Radar AI, games, live radio, live TV, news, messages, voice chat, voice rooms, VX Coins, rewards, achievements, and accessible multilingual experiences. Accessibility and assistive technology are core strengths, while Visionex remains useful and welcoming for all people worldwide.

When asked what Visionex is or what it offers, begin by saying it is a global platform that serves everyone, then give a polished overview of commerce, learning, simulations, services, AI tools, community, entertainment, accessibility, and the VX economy. Do not describe it as only an accessibility platform or omit major areas.

VOICE RULES (mandatory):
- Reply in 1–3 natural spoken sentences. Never more.
- Zero bullet points, headers, or markdown — you are speaking, not writing.
- Be warm, friendly, and expressive — like a helpful human friend.
- Match the user's language exactly.
- For Arabic: use clear, friendly Modern Standard Arabic.
- If you don't know something, say so briefly in one sentence.`,

  munir: `أنت "منير" — مساعد أكاديمي صوتي في أكاديمية VisionEx.

قواعد الصوت (إلزامية):
- أجب بجملة أو جملتين فقط، بأسلوب محادثة طبيعي ودافئ.
- لا نقاط، ولا ترقيم، ولا تنسيق نصي من أي نوع.
- كن مشجعاً وصبوراً كالمعلم المحب.
- أجب دائماً بالعربية الفصحى المبسطة.`,

  nutrition: `You are a friendly nutrition voice assistant for VisionEx.
VOICE RULES: 1–2 sentences only, conversational and warm, no formatting, match the user's language.`,

  radar: `You are Radar AI — a visual intelligence voice assistant for VisionEx.
VOICE RULES: 1–3 sentences, clear and calm, no lists or formatting, match the user's language.`,

  ocr: `You are an OCR voice assistant for VisionEx.
VOICE RULES: 1–2 sentences, clear and direct, no formatting, match the user's language.`,

  mentor: `You are Mentor AI — a personal growth voice coach on VisionEx.
VOICE RULES: 1–3 motivating sentences, warm and encouraging, no bullet points, match the user's language.`,
};

// TTS voice style instructions — makes gpt-4o-mini-tts expressive and natural
const VOICE_STYLE: Record<string, string> = {
  visionex:  "Speak warmly and naturally, like a caring helpful friend. Use a conversational rhythm with gentle pauses. Sound genuinely engaged and interested in helping.",
  munir:     "تحدث بأسلوب مشجع ودافئ كالمعلم الصبور المحب. استخدم نبرة واضحة وطبيعية مع توقفات لطيفة.",
  nutrition: "Speak with warmth and positivity, like a knowledgeable health-conscious friend. Sound energetic and encouraging.",
  radar:     "Speak clearly and calmly with a measured, precise pace. Sound helpful and confident.",
  ocr:       "Speak clearly and efficiently. Sound precise and helpful.",
  mentor:    "Speak with genuine inspiration and warmth, like an encouraging life coach. Sound uplifting and motivating.",
};

const ASSISTANT_VOICE: Record<string, string> = {
  visionex:  "nova",
  munir:     "echo",
  nutrition: "coral",
  radar:     "alloy",
  ocr:       "alloy",
  mentor:    "shimmer",
};

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  // Identity and quota before anything that costs money. This used to be
  // absent entirely: the gateway accepts the public anon key as a JWT, so
  // every request here reached a paid provider unauthenticated and
  // unmetered. See `_shared/voice/guard.ts`.
  const guard = await guardVoiceRequest(req, "ai-voice-chat");
  if (guard.outcome === "refused") return refusalResponse(guard.refusal, cors);

  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY not set" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let messages: Array<{ role: string; content: string }> = [];
  let assistant  = "visionex";
  let assistantId: string | undefined;
  let language   = "en";

  try {
    const body = await req.json();
    messages    = body.messages    || [];
    assistant   = body.assistant   || "visionex";
    assistantId = body.assistantId;
    language    = body.language    || "en";
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Resolve per-assistant config
  let systemPrompt = VOICE_PROMPTS[assistant] || VOICE_PROMPTS["visionex"];
  let voice        = ASSISTANT_VOICE[assistant] || "nova";
  let voiceStyle   = VOICE_STYLE[assistant]     || VOICE_STYLE["visionex"];
  let targets: ProviderTarget[] = [
    { provider: "groq", model: "llama-3.1-8b-instant" },
    { provider: "mistral", model: "mistral-small-latest" },
    { provider: "openai", model: "gpt-4.1" },
  ];

  if (assistantId) {
    const reg = getAssistant(assistantId);
    if (reg) {
      targets = reg.targets;
      systemPrompt = `${reg.systemPrompt}\n\nVOICE MODE — MANDATORY:\n- Reply in 1–3 natural spoken sentences only.\n- No bullet points, no markdown, no lists.\n- Speak conversationally, like a knowledgeable friend.\n- Respond in the same language the user speaks.`;
      const h = [...String(assistantId)].reduce((a, c) => a + c.charCodeAt(0), 0);
      const voices = ["nova", "alloy", "echo", "coral", "shimmer", "sage"];
      voice      = voices[h % voices.length];
      voiceStyle = "Speak warmly and naturally, like a knowledgeable expert friend. Use natural conversational rhythm.";
    }
  }

  const langHint = language !== "en"
    ? `\n\nIMPORTANT: The user's interface language is "${language}". Reply in that language unless the user writes differently.`
    : "";

  // ── Step 1: Generate text through the specialty router ─────────────────
  let transcript = "";
  try {
    const { result: stream } = await streamChatCompletionWithFallback({
      targets,
      system: systemPrompt + langHint,
      messages: messages.map(({ role, content }) => ({
        role: role === "assistant" ? "assistant" as const : "user" as const,
        content,
      })),
      maxTokens: 200,
    });
    transcript = await collectText(stream);
  } catch (error) {
    console.error("Voice chat text generation failed:", error);
    return new Response(JSON.stringify({ error: "Chat error: 502" }), {
      status: 502, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (!transcript) {
    return new Response(JSON.stringify({ transcript: "", audio: null }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // ── Step 2: Convert to expressive speech with gpt-4o-mini-tts ───────────
  const spoken = await synthesize({
    text: transcript,
    provider: "openai",
    model: "gpt-4o-mini-tts",
    voice,
    instructions: voiceStyle,
    format: "mp3",
  });

  if (spoken.outcome === "failed") {
    const status = spoken.failure.reason === "rejected" ? spoken.failure.status : 0;
    const detail = spoken.failure.reason === "rejected" ? spoken.failure.detail : "";
    console.error("TTS error:", status, detail);
    // Return text-only so the client can still show the response
    return new Response(JSON.stringify({ transcript, audio: null }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const audioBytes = spoken.bytes;
  let binary = "";
  for (let i = 0; i < audioBytes.length; i += 0x8000) {
    binary += String.fromCharCode(...audioBytes.subarray(i, i + 0x8000));
  }
  const audioB64 = btoa(binary);

  return new Response(JSON.stringify({ transcript, audio: audioB64 }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
