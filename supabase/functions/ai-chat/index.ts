import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { getAssistant } from "../_shared/assistants.ts";
import { streamChatCompletion, ProviderError, type AIProvider } from "../_shared/aiProvider.ts";

type UserMemory = {
  memory_enabled?: boolean;
  preferred_language?: string | null;
  preferred_tone?: string | null;
  accessibility_needs?: string[] | null;
  interests?: string[] | null;
  frequent_sections?: Record<string, number> | null;
  last_context?: Record<string, unknown> | null;
  summary?: string | null;
  interaction_count?: number | null;
};

function uniqueLimit(values: string[], max = 10) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).slice(0, max);
}

function inferList(text: string, pairs: Array<[RegExp, string]>) {
  return pairs.filter(([pattern]) => pattern.test(text)).map(([, value]) => value);
}

function buildMemoryPrompt(memory: UserMemory | null) {
  if (!memory || memory.memory_enabled === false) return "";
  const parts = [
    memory.preferred_language ? `Preferred language: ${memory.preferred_language}` : "",
    memory.preferred_tone ? `Preferred tone: ${memory.preferred_tone}` : "",
    memory.accessibility_needs?.length ? `Accessibility needs: ${memory.accessibility_needs.join(", ")}` : "",
    memory.interests?.length ? `Known interests: ${memory.interests.join(", ")}` : "",
    memory.summary ? `User memory summary: ${memory.summary}` : "",
  ].filter(Boolean);
  if (parts.length === 0) return "";
  return `\n\n## Adaptive User Memory\nUse this user-owned memory only when relevant. Do not reveal it unless the user asks.\n- ${parts.join("\n- ")}`;
}

function evolveMemory(current: UserMemory | null, params: {
  userId: string;
  messages: Array<{ role: string; content: string }>;
  context: Record<string, unknown>;
}) {
  const lastUserMessage = [...params.messages].reverse().find((message) => message.role !== "assistant")?.content ?? "";
  const text = lastUserMessage.toLowerCase();
  const currentPage = typeof params.context?.currentPage === "string" ? params.context.currentPage : "";
  const pageSection = typeof (params.context?.pageContext as Record<string, unknown> | undefined)?.section === "string"
    ? String((params.context.pageContext as Record<string, unknown>).section)
    : currentPage || "unknown";
  const frequentSections = { ...(current?.frequent_sections ?? {}) };
  frequentSections[pageSection] = Number(frequentSections[pageSection] ?? 0) + 1;

  const accessibilityNeeds = inferList(text, [
    [/(screen reader|قارئ الشاشة|قارئات الشاشة|nvda|jaws|voiceover)/i, "screen_reader"],
    [/(blind|كفيف|مكفوف|فاقد البصر)/i, "blind_or_no_vision"],
    [/(low vision|ضعيف البصر|ضعاف البصر|تكبير|magnifier)/i, "low_vision"],
    [/(keyboard|كيبورد|لوحة المفاتيح)/i, "keyboard_navigation"],
    [/(contrast|تباين|ألوان|الوان|high contrast)/i, "high_contrast"],
    [/(voice|صوت|فويس|نطق|tts)/i, "voice_first"],
  ]);
  const interests = inferList(text, [
    [/(bazaar|بازار|متجر|متاجر|shop|seller|بيع)/i, "bazaar_and_selling"],
    [/(academy|أكاديمية|اكاديمية|تعلم|تعليم|course|دورة)/i, "learning"],
    [/(nutrition|تغذية|وجبة|meal|diet)/i, "nutrition"],
    [/(voice room|فويس روم|رومات|دردشة صوتية)/i, "voice_rooms"],
    [/(game|games|لعبة|ألعاب|العاب)/i, "games"],
    [/(radio|راديو|tv|تلفزيون)/i, "live_media"],
    [/(accessibility|إتاحة|اتاحة|معاق|إعاقة|اعاقة)/i, "accessibility"],
  ]);
  const tone = /مختصر|اختصر|brief|short|concise/i.test(lastUserMessage)
    ? "concise"
    : /تفصيل|بالتفصيل|اشرح|شرح|detailed/i.test(lastUserMessage)
      ? "detailed"
      : current?.preferred_tone ?? null;

  const preferredLanguage = typeof params.context?.language === "string"
    ? String(params.context.language)
    : current?.preferred_language ?? null;
  const oldSummary = current?.summary?.trim() ?? "";
  const summaryBits = [
    oldSummary,
    accessibilityNeeds.length ? `Accessibility: ${accessibilityNeeds.join(", ")}` : "",
    interests.length ? `Interests: ${interests.join(", ")}` : "",
    currentPage ? `Recent page: ${currentPage}` : "",
  ].filter(Boolean).join(" | ");

  return {
    user_id: params.userId,
    memory_enabled: current?.memory_enabled ?? true,
    preferred_language: preferredLanguage,
    preferred_tone: tone,
    accessibility_needs: uniqueLimit([...(current?.accessibility_needs ?? []), ...accessibilityNeeds], 12),
    interests: uniqueLimit([...(current?.interests ?? []), ...interests], 12),
    frequent_sections: frequentSections,
    last_context: {
      currentPage,
      pageSection,
      assistantId: typeof params.context?.assistantId === "string" ? params.context.assistantId : null,
      updatedFrom: "ai-chat",
    },
    summary: summaryBits.slice(0, 900),
    interaction_count: Number(current?.interaction_count ?? 0) + 1,
    updated_at: new Date().toISOString(),
  };
}

const SYSTEM_PROMPT = `You are Visionex AI — a friendly, knowledgeable assistant for the Visionex platform, a global inclusive platform that serves people from all walks of life and all around the world.

## Your Role
You help users navigate the platform, discover products and services, learn from educational content, and get support. You are optional — users choose to interact with you.

## Who Uses Visionex
Visionex serves everyone: sighted users, visually impaired users, blind users, professionals, students, families, and people with diverse needs from every country and culture. Treat every user with equal warmth and respect regardless of their background or ability.

## Platform Identity
When asked what Visionex is, define it as a broad global platform for everyone, not as a platform only for blind or low-vision users and not as only an accessibility website.

Visionex is not only one service or one store. It is a worldwide digital platform where people can learn, work, sell, buy, build projects, get practical support, enjoy entertainment, and connect with others.

Accessibility is a core strength of Visionex. The platform pays special attention to blind and low-vision users through accessible design, assistive products, clear guidance, and inclusive services, while remaining useful and welcoming for all users.

## What Visionex Offers
- **Commerce, products, and VXBazaar**: users can discover general products, services, accessibility tools, and assistive technology. Sellers can bring their shops to Visionex and turn them into rich digital storefronts that feel like real stores, with listings, product details, buyer communication, and inclusive presentation.
- **Education and independent projects**: users can learn through the Academy, articles, courses, simulations, professional training, and practical business tools. Help them connect learning to real outcomes, including starting independent projects or improving their current work.
- **Consulting and support services**: Visionex includes study and Academy guidance, career guidance, nutrition support, psychology and emotional-support sessions, legal and technical guidance, marketing, web design, import/purchasing, and simple safe medical information. For medical, legal, mental-health, or financial topics, give safe general information and recommend qualified professionals for serious or personal decisions.
- **Entertainment and community**: Visionex includes games, live radio, live TV, voice chat with friends, voice rooms for meeting new people, community features, messages, and social connection tools.
- **AI companion across the site**: Visionex includes AI assistants that help users navigate the platform, understand services, improve listings, learn, summarize content, plan projects, and ask questions about the site.

## Knowledge Priority (strict order)
1. **Visionex platform content** — products, courses, articles, services, and educational materials
2. **Relevant specialized sources** — for accessibility topics: AFB, NFB, RNIB, DAISY Consortium, APH and similar organizations
3. **General reliable sources** — for any other topic the user asks about

## Capabilities
- **Product Advisor**: Recommend products, compare options, explain features, suggest alternatives
- **Learning Assistant**: Explain lessons simply, answer questions about courses/articles, summarize content, suggest learning paths
- **Platform Guide**: Help users navigate the website, explain features and sections
- **Business & Store Guide**: Help sellers understand VXBazaar, improve shop/listing quality, and connect learning or consulting services to real project ideas
- **Accessibility Guide**: Explain accessible products, inclusive design, screen-reader-friendly practices, and low-vision support in plain language
- **Entertainment & Community Guide**: Explain games, live radio, live TV, voice rooms, voice chat, messages, and social discovery features
- **General Q&A**: Answer any question clearly and helpfully

## Platform Sections (guide users here)
- **/marketplace** — Products (general store & accessibility store)
- **/assistive-products** — Assistive technology catalog (Braille displays, screen readers, smart canes, magnifiers, etc.)
- **/content** — Educational articles, courses, and guides
- **/games** — Interactive learning games
- **/services** — Professional services
- **/leaderboard** — Points leaderboard
- **/bazaar** — User marketplace

## Additional Platform Guidance
- **/bazaar**: VXBazaar, where users can open and manage rich digital shops
- **/academy**: learning, study support, and educational growth
- **/simulations**: practical simulations that teach business and professional skills
- **/services/nutrition**: nutrition support and meal planning tools
- **/services/live-radio**: live radio entertainment
- **/services/live-tv**: live TV entertainment
- **/community/voice-rooms**: voice rooms for conversation and meeting people
- **/messages**: private messages and friend communication
- **/professional-tools**: downloadable professional tools
- **/news**: platform news and updates

## Communication Style
- Keep answers **clear, concise, and helpful**
- Use **simple language** — avoid jargon unless explaining it
- Structure responses with **short paragraphs** and **bullet points**
- Always be **warm, supportive, and patient**
- Respond in the **same language** the user writes in

## Important Rules
- Never make up product prices or availability — say "check the product page for current details"
- Never present Visionex as only an accessibility platform, only a marketplace, only a services website, or only an education site. It is a broad inclusive global platform with accessibility as a core strength.
- For medical, psychological, legal, or financial topics, provide safe general guidance only. Do not diagnose, prescribe, guarantee outcomes, or replace qualified professionals.
- If you don't know something, say so honestly and suggest where to find the answer
- Support all users equally regardless of ability, language, or background`;

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authPreview = await req.clone().json().catch(() => ({}));
    const assistantIdForAuth =
      typeof authPreview.assistantId === "string" ? authPreview.assistantId : undefined;

    // Domain assistants require a real user session; the default assistant can run with anon auth.
    const authHeader = req.headers.get("Authorization");
    if (assistantIdForAuth && !authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      authHeader ? { global: { headers: { Authorization: authHeader } } } : undefined
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if ((authErr || !user) && assistantIdForAuth) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Rate limiting: 60 requests / user / day ────────────────────────
    const serviceClient = user
      ? createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        )
      : null;

    if (user && serviceClient) {
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
    }

    const { messages, context = {}, assistantId } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Resolve provider, model, and system prompt ─────────────────────
    let provider: AIProvider = "openai";
    let model = "gpt-4.1";
    let systemPrompt = SYSTEM_PROMPT;
    let userMemory: UserMemory | null = null;
    const memoryAllowed = context?.companionMemoryEnabled !== false;

    if (user && serviceClient && memoryAllowed) {
      const { data } = await serviceClient
        .from("ai_user_memory")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      userMemory = data as UserMemory | null;
    }

    const assistant = getAssistant(assistantId);
    if (assistant) {
      // Registry-driven domain assistant (legal, medical, sports, …)
      provider = assistant.provider;
      model = assistant.model;
      systemPrompt = assistant.systemPrompt;
      if (context?.language) {
        systemPrompt += `\n\nUser's preferred language: ${context.language}. Respond in this language.`;
      }
    } else if (context?.voiceMode) {
      // Voice mode: short, conversational, no markdown
      systemPrompt = `You are Visionex AI, a warm, friendly voice assistant for VisionEx, a global platform for everyone, with a special commitment to accessibility for blind and low-vision users.

VisionEx helps users learn through the Academy, shop, open or move stores into VXBazaar, build independent projects through courses and simulations, use consulting services for study, nutrition, emotional support, safe medical information, technology and business, enjoy games, live radio and live TV, and connect through messages, voice chat, and voice rooms. It includes an AI companion that helps users across the site.

VOICE RULES (mandatory — you are speaking, not writing):
- Reply in 1–3 natural spoken sentences. Never more.
- Zero bullet points, headers, or markdown.
- Be warm and conversational, like a helpful human friend.
- Respond in the same language the user speaks.`;
      if (context?.language) {
        systemPrompt += `\nUser's language: ${context.language}. Reply in that language.`;
      }
      if (context?.pageContext) {
        systemPrompt += `\nCurrent page context: ${JSON.stringify(context.pageContext)}`;
      }
      if (Array.isArray(context?.companionMemory) && context.companionMemory.length > 0) {
        systemPrompt += `\nRelevant saved user preferences: ${context.companionMemory.join("; ")}`;
      }
    } else {
      // Default Visionex assistant + Business Simulation mentor mode
      const isSimulation = context?.productName?.startsWith("Business Simulation:");
      if (isSimulation) {
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
        if (context?.pageContext) {
          systemPrompt += `\n\n## Live Page Context\n${JSON.stringify(context.pageContext, null, 2)}`;
        }
        if (Array.isArray(context?.companionMemory) && context.companionMemory.length > 0) {
          systemPrompt += `\n\n## User-Approved Memory\nUse these saved preferences only when relevant:\n- ${context.companionMemory.join("\n- ")}`;
        }
        if (Array.isArray(context?.companionCapabilities) && context.companionCapabilities.length > 0) {
          systemPrompt += `\n\n## Companion Capabilities\nThe client can support: ${context.companionCapabilities.join(", ")}. If the user asks for navigation or saved preferences, acknowledge the action naturally.`;
        }
        if (context?.toolIntent) {
          systemPrompt += `\n\n## Tool Intent\nThe client detected this intent: ${context.toolIntent}`;
        }
        if (Array.isArray(context?.productMatches) && context.productMatches.length > 0) {
          systemPrompt += `\n\n## Known Product Matches\nUse these known Visionex products before giving general recommendations:\n${JSON.stringify(context.productMatches, null, 2)}`;
        }
        if (context?.productName) {
          systemPrompt += `\nThey are viewing the product: ${context.productName}`;
        }
      }
      if (context?.language) {
        systemPrompt += `\nUser's preferred language: ${context.language}. Respond in this language.`;
      }
    }

    // ── Stream via the unified provider layer ──────────────────────────
    systemPrompt += buildMemoryPrompt(userMemory);

    const cleanMessages = messages.map((m: { role: string; content: string }) => ({
      role: m.role === "assistant" ? "assistant" as const : "user" as const,
      content: m.content,
    }));

    if (user && serviceClient && memoryAllowed && userMemory?.memory_enabled !== false) {
      const evolved = evolveMemory(userMemory, {
        userId: user.id,
        messages,
        context: { ...context, assistantId },
      });
      const { error: memoryError } = await serviceClient
        .from("ai_user_memory")
        .upsert(evolved, { onConflict: "user_id" });
      if (memoryError) console.error("ai memory upsert error:", memoryError.message);
    }

    try {
      const stream = await streamChatCompletion({
        provider,
        model,
        system: systemPrompt,
        messages: cleanMessages,
      });
      return new Response(stream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    } catch (e) {
      if (e instanceof ProviderError) {
        if (e.status === 429) {
          return new Response(
            JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ error: "AI service temporarily unavailable" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw e;
    }
  } catch (e) {
    console.error("ai-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
