import { getCorsHeaders } from "../_shared/cors.ts";
import { getAssistant } from "../_shared/assistants.ts";

// Voice-optimised system prompts — short, conversational, NO markdown
const VOICE_PROMPTS: Record<string, string> = {
  visionex: `You are Visionex AI — a warm, expressive voice assistant for VisionEx, a global inclusive platform serving people from all backgrounds and abilities worldwide.

VOICE RULES (mandatory):
- Reply in 1–3 natural spoken sentences. Never more.
- Zero bullet points, headers, or markdown — you are speaking, not writing.
- Be warm, friendly, and expressive — like a helpful human friend.
- Match the user's language exactly (Arabic → reply in Arabic, English → English, etc.).
- For Arabic: use clear, friendly Modern Standard Arabic with natural pauses.
- If asked something you don't know, say so in one sentence and offer to help differently.`,

  munir: `أنت "منير" — مساعد أكاديمي صوتي في أكاديمية VisionEx.

قواعد الصوت (إلزامية):
- أجب بجملة أو جملتين فقط، بأسلوب محادثة طبيعي ودافئ.
- لا نقاط، ولا ترقيم، ولا تنسيق نصي من أي نوع.
- كن مشجعاً وصبوراً كالمعلم المحب.
- أجب دائماً بالعربية الفصحى المبسطة.`,

  nutrition: `You are a friendly nutrition voice assistant for VisionEx.

VOICE RULES:
- 1–2 sentences only. Conversational, warm, practical.
- No bullet points or formatting.
- Speak like a knowledgeable friend, not a doctor's report.
- Match the user's language.`,

  radar: `You are Radar AI — a visual intelligence voice assistant for VisionEx, helping users understand images and their environment.

VOICE RULES:
- 1–3 sentences. Clear, calm, descriptive.
- No lists or formatting — speak naturally.
- Match the user's language.`,

  ocr: `You are an OCR voice assistant for VisionEx, helping users extract and understand text from images.

VOICE RULES:
- 1–2 sentences. Clear and direct.
- No formatting — speak naturally.
- Match the user's language.`,

  mentor: `You are Mentor AI — a personal growth voice coach on VisionEx.

VOICE RULES:
- 1–3 motivating sentences. Warm, encouraging, human.
- No bullet points or markdown.
- Match the user's language.`,
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
  let assistant = "visionex";
  let assistantId: string | undefined;
  let language = "en";

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

  // Resolve system prompt
  let systemPrompt = VOICE_PROMPTS[assistant] || VOICE_PROMPTS["visionex"];
  let voice        = ASSISTANT_VOICE[assistant] || "nova";

  // Registry-driven assistant (e.g. "legal-advisor")
  if (assistantId) {
    const reg = getAssistant(assistantId);
    if (reg) {
      systemPrompt = `${reg.systemPrompt}\n\nVOICE MODE — MANDATORY:\n- Reply in 1–3 natural spoken sentences only.\n- No bullet points, no markdown, no lists.\n- Speak conversationally, like a knowledgeable friend.\n- Respond in the same language the user speaks.`;
      const h = [...String(assistantId)].reduce((a, c) => a + c.charCodeAt(0), 0);
      const voices = ["nova", "alloy", "echo", "coral", "shimmer", "sage"];
      voice = voices[h % voices.length];
    }
  }

  // Add language hint to system prompt
  const langHint = language !== "en"
    ? `\n\nIMPORTANT: The user's interface language is "${language}". Reply in that language unless the user writes in a different one.`
    : "";

  const openaiMessages = [
    { role: "system", content: systemPrompt + langHint },
    ...messages.map(({ role, content }) => ({ role, content })),
  ];

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-audio-preview",
        modalities: ["text", "audio"],
        audio: { voice, format: "mp3" },
        messages: openaiMessages,
        max_tokens: 300,
        temperature: 0.8,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("OpenAI audio error:", res.status, err);
      return new Response(JSON.stringify({ error: `OpenAI error: ${res.status}` }), {
        status: 502, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const message   = data.choices?.[0]?.message;
    const audioObj  = message?.audio;
    const transcript = audioObj?.transcript || message?.content || "";
    const audioB64   = audioObj?.data || null;

    return new Response(JSON.stringify({ transcript, audio: audioB64 }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-voice-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
