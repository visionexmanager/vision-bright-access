import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ["https://visionex.app", "https://www.visionex.app"];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) || origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")
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

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { voice = "alloy", assistant = "visionex" } = await req.json().catch(() => ({}));

    // Pick voice based on assistant
    const voiceMap: Record<string, string> = {
      visionex:  voice || "alloy",
      munir:     "echo",   // Arabic-friendly deep voice for منير
      nutrition: "nova",   // Warm voice for nutrition expert
      radar:     "alloy",  // Visual scene assistant
      ocr:       "alloy",  // Text reading assistant
      mentor:    "onyx",   // Business mentor — confident voice
    };

    const selectedVoice = voiceMap[assistant] || "alloy";

    const instructionsMap: Record<string, string> = {
      visionex: VISIONEX_VOICE_INSTRUCTIONS,
      munir: `أنت "منير" — مساعد أكاديمي صوتي ذكي في أكاديمية VisionEx. تتحدث بلهجة عربية ودودة ومبسطة. أجب دائماً بالعربية. كن مشجعاً وصبوراً. اشرح الأفكار بجمل قصيرة وواضحة.`,
      nutrition: `You are a friendly nutrition voice assistant for Visionex Health. Help users with meal analysis, diet planning, calorie tracking, and healthy eating advice. Keep responses short and conversational. Speak in the same language as the user.`,
      radar: `You are Radar AI — a voice assistant for the Visionex visual scene analyzer. Help visually impaired users understand image analysis results, describe scenes in detail, and answer questions about what was detected in the image. Keep responses clear and concise. Speak in the same language as the user.`,
      ocr: `You are the Visionex OCR assistant. Help users with text extracted from images and documents — read it aloud, summarize it, translate it, or answer questions about it. Keep responses clear and concise. Speak in the same language as the user.`,
      mentor: `You are a Business Mentor AI on the Visionex platform. Guide users through interactive business simulations, explain real-world business concepts, give practical hints without spoiling the full answer, and keep learners motivated. Speak naturally and conversationally — short sentences, no bullet points. Respond in the same language the user speaks.`,
    };

    // Create ephemeral session token
    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview",
        voice: selectedVoice,
        instructions: instructionsMap[assistant] || VISIONEX_VOICE_INSTRUCTIONS,
        input_audio_transcription: { model: "whisper-1" },
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 600,
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

    return new Response(JSON.stringify({
      client_secret: session.client_secret,
      session_id: session.id,
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
