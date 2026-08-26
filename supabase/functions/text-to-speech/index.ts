import { synthesizeResponse } from "../_shared/voice/tts.ts";
import { guardVoiceRequest, refusalResponse } from "../_shared/voice/guard.ts";
const ALLOWED_ORIGINS = ["https://visionex.app", "https://www.visionex.app"];

function getCorsHeaders(req: Request): Record<string, string> {
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

const VOICE_MAP: Record<string, string> = {
  visionex:  "nova",
  munir:     "echo",
  nutrition: "coral",
  radar:     "alloy",
  ocr:       "alloy",
  mentor:    "shimmer",
};

// Per-assistant style instructions make gpt-4o-mini-tts expressive and natural
const STYLE_MAP: Record<string, string> = {
  visionex:  "Speak warmly and naturally, like a caring helpful friend. Use a conversational rhythm with gentle pauses. Sound genuinely engaged.",
  munir:     "تحدث بأسلوب مشجع ودافئ كالمعلم الصبور. استخدم نبرة واضحة وطبيعية.",
  nutrition: "Speak with warmth and positivity, like a knowledgeable health-conscious friend. Sound energetic.",
  radar:     "Speak clearly and calmly with a measured, precise pace. Sound confident and helpful.",
  ocr:       "Speak clearly and efficiently. Sound precise and helpful.",
  mentor:    "Speak with genuine inspiration and warmth, like an encouraging life coach. Sound uplifting.",
};

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Identity and quota before anything that costs money. This used to be
  // absent entirely: the gateway accepts the public anon key as a JWT, so
  // every request here reached a paid provider unauthenticated and
  // unmetered. See `_shared/voice/guard.ts`.
  const guard = await guardVoiceRequest(req, "text-to-speech");
  if (guard.outcome === "refused") return refusalResponse(guard.refusal, corsHeaders);

  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY not set" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let text = "";
  let voice = "nova";
  let instructions = STYLE_MAP["visionex"];

  try {
    const body = await req.json();
    text  = (body.text as string) || "";
    const assistant = (body.assistant as string) || "visionex";
    voice        = (body.voice as string)  || VOICE_MAP[assistant] || "nova";
    instructions = STYLE_MAP[assistant]    || STYLE_MAP["visionex"];
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!text.trim()) {
    return new Response(JSON.stringify({ error: "text is required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const trimmed = text.length > 4000 ? text.slice(0, 4000) + "…" : text;

  // `synthesizeResponse`, not `synthesize`: this endpoint hands the provider's
  // body straight to the browser, and buffering it here would delay the first
  // word a listener hears. The seam builds the request and classifies a
  // failure; the stream stays untouched.
  const call = await synthesizeResponse({
    text: trimmed,
    provider: "openai",
    model: "gpt-4o-mini-tts",
    voice,
    instructions,
    format: "mp3",
  });

  if (call.outcome === "failed") {
    const status = call.failure.reason === "rejected" ? call.failure.status : 0;
    const detail = call.failure.reason === "rejected" ? call.failure.detail : "";
    console.error("TTS error:", status, detail);
    return new Response(JSON.stringify({ error: `TTS failed: ${status}` }), {
      status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(call.response.body, {
    headers: { ...corsHeaders, "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
  });
});
