import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAssistant } from "../_shared/assistants.ts";

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

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth check — require user JWT
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authError || !user) {
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

    const { voice, assistant = "visionex", assistantId } = await req.json().catch(() => ({}));

    // gpt-realtime-2 voices: sage, cedar, coral, ash, verse, ballad, marin
    const VOICES = ["sage", "cedar", "coral", "ash", "verse", "ballad", "marin"];

    const voiceMap: Record<string, string> = {
      visionex:  voice || "sage",
      munir:     "cedar",
      nutrition: "coral",
      radar:     "ash",
      ocr:       "verse",
      mentor:    "ballad",
    };

    const instructionsMap: Record<string, string> = {
      visionex: VISIONEX_VOICE_INSTRUCTIONS,
      munir: `أنت "منير" — مساعد أكاديمي صوتي ذكي في أكاديمية VisionEx. تتحدث بلهجة عربية ودودة ومبسطة. أجب دائماً بالعربية. كن مشجعاً وصبوراً. اشرح الأفكار بجمل قصيرة وواضحة.`,
      nutrition: `You are a friendly nutrition voice assistant for Visionex. Help users with meal analysis, diet planning, and healthy eating advice. Keep responses short and conversational.`,
      radar: `You are Radar AI — a visual intelligence voice assistant for Visionex. You help visually impaired users understand images, identify objects, read text in images, and describe environments. Speak clearly and concisely. Respond in the same language the user uses.`,
      ocr: `You are an OCR voice assistant for Visionex. Help users extract and understand text from images. Guide them through the scanning process with clear, simple voice instructions. Respond in the same language the user uses.`,
      mentor: `You are Mentor AI — a personal growth and learning voice coach on Visionex. Guide users through skill development, answer educational questions, and motivate them with warm, encouraging advice. Keep responses short and conversational.`,
    };

    // A registry-driven domain assistant (legal, medical, …) overrides the built-ins.
    const registered = getAssistant(assistantId);
    let selectedVoice: string;
    let instructions: string;
    if (registered) {
      const h = [...String(assistantId)].reduce((a, c) => a + c.charCodeAt(0), 0);
      selectedVoice = voice || VOICES[h % VOICES.length];
      instructions = `${registered.systemPrompt}\n\nVOICE MODE: You are speaking out loud, not writing. Keep responses short and conversational, use natural sentences (no bullet lists or markdown), and respond in the user's language.`;
    } else {
      selectedVoice = voiceMap[assistant] || "sage";
      instructions = instructionsMap[assistant] || VISIONEX_VOICE_INSTRUCTIONS;
    }

    // gpt-realtime-2: /v1/realtime/client_secrets does NOT accept turn_detection.
    // turn_detection is configured client-side via session.update after WebRTC connects.
    const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session: {
          model: "gpt-realtime-2",
          instructions,
          audio: {
            output: { voice: selectedVoice },
            input: { transcription: { model: "gpt-4o-mini-transcribe" } },
          },
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("OpenAI Realtime session error:", response.status, err);
      let openaiError = "Failed to create realtime session";
      try { openaiError = JSON.parse(err)?.error?.message || openaiError; } catch {
        // Keep the generic message when OpenAI returns a non-JSON error body.
      }
      return new Response(JSON.stringify({ error: openaiError, status: response.status }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const session = await response.json();
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
