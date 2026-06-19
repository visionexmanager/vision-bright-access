import { getCorsHeaders } from "../_shared/cors.ts";
import { getAssistant } from "../_shared/assistants.ts";

// Voice-optimised system prompts — short conversational sentences, no markdown
const VOICE_PROMPTS: Record<string, string> = {
  visionex: `You are Visionex AI — a warm, expressive voice assistant for VisionEx, a global inclusive platform serving people of all backgrounds and abilities worldwide.

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

const ALLOWED_ORIGINS = ["https://visionex.app", "https://www.visionex.app"];

function getCors(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowed =
    ALLOWED_ORIGINS.includes(origin) || origin.startsWith("http://localhost")
      ? origin
      : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

Deno.serve(async (req) => {
  const cors = getCors(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

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

  if (assistantId) {
    const reg = getAssistant(assistantId);
    if (reg) {
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

  // ── Step 1: Get text response from gpt-4.1 ───────────────────────────────
  const chatRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1",
      messages: [
        { role: "system", content: systemPrompt + langHint },
        ...messages.map(({ role, content }) => ({ role, content })),
      ],
      max_tokens: 200,
      temperature: 0.8,
    }),
  });

  if (!chatRes.ok) {
    const err = await chatRes.text();
    console.error("Chat error:", chatRes.status, err);
    return new Response(JSON.stringify({ error: `Chat error: ${chatRes.status}` }), {
      status: 502, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const chatData   = await chatRes.json();
  const transcript = chatData.choices?.[0]?.message?.content as string || "";

  if (!transcript) {
    return new Response(JSON.stringify({ transcript: "", audio: null }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // ── Step 2: Convert to expressive speech with gpt-4o-mini-tts ───────────
  const ttsRes = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts",
      input: transcript,
      voice,
      instructions: voiceStyle,
      response_format: "mp3",
    }),
  });

  if (!ttsRes.ok) {
    const err = await ttsRes.text();
    console.error("TTS error:", ttsRes.status, err);
    // Return text-only so the client can still show the response
    return new Response(JSON.stringify({ transcript, audio: null }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const audioBytes = await ttsRes.arrayBuffer();
  const audioB64   = btoa(String.fromCharCode(...new Uint8Array(audioBytes)));

  return new Response(JSON.stringify({ transcript, audio: audioB64 }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
