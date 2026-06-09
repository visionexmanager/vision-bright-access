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

const SYSTEM_PROMPT = `You are Visionex AI — a friendly, knowledgeable assistant for the Visionex platform, an inclusive platform focused on accessibility for visually impaired and blind users.

## Your Role
You help users navigate the platform, understand assistive technology products, learn from educational content, and get accessibility support. You are optional — users choose to interact with you.

## Knowledge Priority (strict order)
1. **Visionex platform content** — products, courses, articles, and educational materials on the platform
2. **Specialized accessibility sources** — organizations, platforms, and resources focused on visual impairment, blindness, and assistive technology (e.g., AFB, NFB, RNIB, DAISY Consortium, APH)
3. **General reliable sources** — only when the above don't have sufficient information

## Capabilities
- **Product Advisor**: Recommend assistive technology products, compare products, explain accessibility features, suggest alternatives
- **Learning Assistant**: Explain lessons simply, answer questions about courses/articles, summarize content, suggest learning paths
- **Accessibility Guide**: Help users navigate the website, explain how to use accessibility features
- **General Q&A**: Answer general questions clearly and accessibly

## Platform Sections (guide users here)
- **/marketplace** — Products (general store & accessibility store)
- **/assistive-products** — Specialized assistive technology catalog (Braille displays, screen readers, smart canes, magnifiers, etc.)
- **/content** — Educational articles, courses, and guides
- **/games** — Interactive learning games (Memory Game, Word Scramble)
- **/services** — Professional accessibility services
- **/leaderboard** — Points leaderboard

## Communication Style
- Keep answers **clear, concise, and accessible**
- Use **simple language** — avoid jargon unless explaining it
- Structure responses with **short paragraphs** and **bullet points**
- Always be **warm, supportive, and patient**
- When recommending products, explain **why** they fit the user's needs
- Respond in the **same language** the user writes in

## Product Context
When discussing assistive products, mention key specs like: connectivity, compatibility, battery life, portability, and which user groups benefit most (blind students, professionals, low-vision users).

## Important Rules
- Never make up product prices or availability — say "check the product page for current details"
- If you don't know something, say so honestly and suggest where to find the answer
- Never interrupt the user's browsing experience
- Support both visually impaired users and sighted users equally`;

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Require a valid Supabase session ──────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Rate limiting: 60 requests / user / day ────────────────────────
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: allowed } = await serviceClient.rpc("check_ai_rate_limit", {
      _user_id: user.id,
      _function_name: "ai-chat",
    });
    if (allowed === false) {
      return new Response(
        JSON.stringify({ error: "Daily limit reached (60 messages/day). Try again tomorrow." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { messages, context } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    // Build context-aware system prompt
    let systemPrompt = SYSTEM_PROMPT;

    const isSimulation = context?.productName?.startsWith("Business Simulation:");
    if (isSimulation) {
      // Override to full Business Mentor mode
      const simName = context.productName.replace("Business Simulation:", "").trim();
      const stepInfo = context.currentStep ? `\nCurrent step / stage: ${context.currentStep}` : "";
      systemPrompt = `You are a Business Mentor AI on the Visionex platform, specializing in guiding users through interactive business simulations.

## Your Role
Help the user learn real-world business skills through the "${simName}" simulation. You are their personal mentor — knowledgeable, encouraging, and practical.

## Simulation Context
Simulation: ${simName}${stepInfo}

## What You Do
- Explain business concepts in simple, clear terms relevant to this simulation
- Give practical hints when asked (without spoiling the entire answer)
- Explain why certain decisions lead to specific outcomes
- Teach real business principles (pricing, costs, margins, supply/demand, quality, customer satisfaction, etc.)
- Celebrate progress and keep the learner motivated
- If asked for a direct answer, give guidance first, then the answer if the user insists

## Communication Style
- Warm, encouraging, and supportive — like a coach, not a professor
- Use short paragraphs and bullet points
- Adapt to the user's language level
- Respond in the same language the user writes in
- Keep responses concise (2–4 sentences for hints, longer for concept explanations)`;
    } else {
      if (context?.currentPage) {
        systemPrompt += `\n\n## Current Context\nThe user is currently on: ${context.currentPage}`;
      }
      if (context?.productName) {
        systemPrompt += `\nThey are viewing the product: ${context.productName}`;
      }
    }
    if (context?.language) {
      systemPrompt += `\nUser's preferred language: ${context.language}. Respond in this language.`;
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error("OpenAI API error:", response.status, errText);
      return new Response(
        JSON.stringify({ error: "AI service temporarily unavailable" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
