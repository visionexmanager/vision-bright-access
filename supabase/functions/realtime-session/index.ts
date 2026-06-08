import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ALLOWED_ORIGINS = ["https://visionex.app", "https://www.visionex.app"];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) || origin.startsWith("http://localhost")
    ? origin
    : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

const VISIONEX_VOICE_INSTRUCTIONS = `You are Visionex AI — a friendly, knowledgeable voice assistant for the Visionex platform, an inclusive platform focused on accessibility for visually impaired and blind users.

Your Role:
- Help users navigate the platform and find assistive technology products
- Answer questions about courses, articles, and educational content
- Guide users through accessibility features and support

Communication Style:
- Speak naturally and conversationally — you are talking, not writing
- Keep responses short and clear — no long paragraphs
- Be warm, supportive, and patient
- Respond in the same language the user speaks (Arabic or English)
- Avoid listing bullet points — speak in natural sentences

When speaking Arabic, use a clear, friendly Modern Standard Arabic.`;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { voice = "sage", assistant = "visionex" } = await req.json().catch(() => ({}));

    // New voice names for gpt-realtime-2: sage, cedar, coral, ash, verse, ballad, marin
    const voiceMap: Record<string, string> = {
      visionex:  voice || "sage",
      munir:     "cedar",
      nutrition: "coral",
    };

    const selectedVoice = voiceMap[assistant] || "sage";

    const instructionsMap: Record<string, string> = {
      visionex: VISIONEX_VOICE_INSTRUCTIONS,
      munir: `أنت "منير" — مساعد أكاديمي صوتي ذكي في أكاديمية VisionEx. تتحدث بلهجة عربية ودودة ومبسطة. أجب دائماً بالعربية. كن مشجعاً وصبوراً. اشرح الأفكار بجمل قصيرة وواضحة.`,
      nutrition: `You are a friendly nutrition voice assistant for Visionex. Help users with meal analysis, diet planning, and healthy eating advice. Keep responses short and conversational.`,
    };

    // gpt-realtime-2 uses /v1/realtime/client_secrets with nested session object
    const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model: "gpt-realtime-2",
          voice: selectedVoice,
          instructions: instructionsMap[assistant] || VISIONEX_VOICE_INSTRUCTIONS,
          input_audio_transcription: { model: "whisper-1" },
          turn_detection: {
            type: "server_vad",
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 600,
          },
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("OpenAI Realtime session error:", response.status, err);
      let openaiError = "Failed to create realtime session";
      try { openaiError = JSON.parse(err)?.error?.message || openaiError; } catch {}
      return new Response(JSON.stringify({ error: openaiError, status: response.status }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const session = await response.json();
    // New API returns { value: "ephemeral-key" } at root
    const ephemeralValue = session.value ?? session.client_secret?.value;

    return new Response(JSON.stringify({
      client_secret: { value: ephemeralValue },
      session_id: session.id ?? "session",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("realtime-session error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
