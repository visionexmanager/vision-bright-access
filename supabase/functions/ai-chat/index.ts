import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { getAssistant } from "../_shared/assistants.ts";
import {
  streamChatCompletionWithFallback,
  structuredCompletionWithFallback,
  ProviderError,
  type ProviderTarget,
} from "../_shared/aiProvider.ts";
import { assistantTargets } from "../_shared/assistants.ts";

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
Visionex serves everyone: professionals, students, families, entrepreneurs, and people with diverse needs from every country and culture. Treat every user with equal warmth and respect regardless of their background or ability.

## Platform Identity
When asked what Visionex is, define it as a broad global platform for everyone, not as a platform only for blind or low-vision users and not as only an accessibility website.

Visionex is not only one service or one store. It is a worldwide digital platform where people can learn, work, sell, buy, build projects, get practical support, enjoy entertainment, and connect with others.

VisionEx is a fully accessible platform built for everyone — inclusive design, assistive-friendly features, and services that welcome all users regardless of ability or background.

## Mandatory Default Answer About Visionex
If the user asks "What is Visionex?", "Tell me about Visionex", "What does Visionex offer?", or any equivalent question in any language, answer with a polished, welcoming overview in the user's language. Begin by stating clearly that **Visionex is a global platform that serves everyone**. Then cover every relevant pillar below without reducing Visionex to a single category:
- VXBazaar and commerce: buying products, discovering general and assistive products, opening a shop, and turning an existing business into a rich accessible digital storefront.
- Academy and learning: courses, articles, study help, professional training, and educational guidance.
- Practical simulations and independent projects: interactive business and professional simulations that help users learn skills, test decisions, and plan real projects.
- Professional and personal services: career, study, nutrition, psychology and emotional support, safe general medical information, legal guidance, technology consulting, digital marketing, web design, importing and purchasing, travel, sports, music, creative production, hair care, skin care, and other available services.
- AI tools: the site-wide Visionex companion, specialist assistants, image analysis, meal analysis, OCR, Radar AI for understanding scenes, planning tools, and help navigating and using the platform.
- Community and communication: messages, friendships, voice chat, voice rooms, live discussions, collaboration, and social discovery.
- Entertainment and media: games, live radio, live television, news, and interactive experiences.
- Accessibility and assistive technology: screen-reader-friendly design, keyboard and voice support, multilingual use, assistive-product guidance, and inclusive experiences for everyone regardless of ability.
- VX economy: VX Coins, rewards, advertisements that grant rewards, achievements, and platform features unlocked through the Visionex economy.
End with a concise invitation to tell the user which goal they want help with so you can guide them to the right section. Keep the answer elegant and well structured, but do not omit a pillar merely to make it shorter.

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
- **Accessibility Guide**: Explain accessible products, inclusive design, and assistive-friendly features in plain language
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

    // Platform-wide daily ceiling, checked before the per-user limit. Fails
    // open by design (see check_ai_budget) so a metering fault cannot take the
    // assistant offline for everyone.
    if (serviceClient) {
      const { data: withinBudget } = await serviceClient.rpc("check_ai_budget");
      if (withinBudget === false) {
        console.error("[ai-chat] daily AI budget reached — refusing new requests.");
        return new Response(
          JSON.stringify({ error: "The assistant is temporarily unavailable. Please try again later." }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

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

    // Grading carries no conversation, so it is checked before the rule that
    // there must be one. Requiring a placeholder message would be a shape the
    // client has to know about for no reason.
    if (assistantId !== "ivx-project-grader"
        && (!messages || !Array.isArray(messages) || messages.length === 0)) {
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Grading an IVX project ─────────────────────────────────────────
    //
    // The one path through this function that does not stream. A grade is not
    // a conversation: it is a number and a note per rubric criterion, it has
    // to be written to the database before the student sees it, and half of
    // one arriving token by token would be worse than useless.
    //
    // Everything that matters happens with the service role. The brief, the
    // rubric and the submitted work come from `ivx_project_for_grading`, and
    // the result goes back through `ivx_project_grade` — neither of which a
    // browser can call. What the client sends is a project slug; what it gets
    // back is what was stored, not what it asked for.
    if (assistantId === "ivx-project-grader" && user && serviceClient) {
      const slug = typeof context?.ivxProjectSlug === "string" ? context.ivxProjectSlug : null;
      if (!slug) {
        return new Response(
          JSON.stringify({ error: "ivxProjectSlug is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: packet } = await serviceClient.rpc("ivx_project_for_grading", {
        _user_id: user.id,
        _slug: slug,
        _language: typeof context?.language === "string" ? context.language : "en",
      });
      const brief = (packet ?? null) as {
        ok?: boolean; reason?: string; title?: string; brief?: string; language?: string;
        rubric?: Array<{ id: string; weight: number; criterion: string }>; work?: string;
      } | null;

      if (!brief?.ok) {
        return new Response(
          JSON.stringify({ error: "There is nothing submitted to grade.", reason: brief?.reason ?? "unavailable" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const criteria = brief.rubric ?? [];
      const graded = await structuredCompletionWithFallback({
        targets: assistantTargets("ivx-project-grader"),
        system: [
          "You are marking one student's project against a fixed rubric, and you will never meet them.",
          "Award each criterion a score out of its own weight — never out of 100 — and give one sentence saying what earned it and what would earn more.",
          "Mark what is in front of you. Do not reward length, confidence, or effort you cannot see in the work, and do not penalise unusual formatting: this may have been typed on a phone or with a screen reader.",
          "If the work does not address a criterion at all, score it zero and say so plainly. A generous mark for absent work teaches the student nothing.",
          `Write every note in ${brief.language ?? "en"}, addressed to the student as "you".`,
        ].join("\n"),
        userText: [
          `PROJECT: ${brief.title ?? ""}`,
          `BRIEF: ${brief.brief ?? ""}`,
          "RUBRIC:",
          ...criteria.map((c) => `- ${c.id} (out of ${c.weight}): ${c.criterion}`),
          "",
          "THE STUDENT'S WORK:",
          brief.work ?? "",
        ].join("\n"),
        schema: {
          type: "object",
          properties: {
            summary: { type: "string", description: "Two or three sentences to the student about the work as a whole." },
            criteria: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  score: { type: "number" },
                  note: { type: "string" },
                },
                required: ["id", "score", "note"],
              },
            },
          },
          required: ["summary", "criteria"],
        },
        toolName: "record_grade",
        maxTokens: 1200,
      }).catch((error: unknown) => {
        console.error("[ai-chat] project grading failed:", error instanceof ProviderError ? error.status : "unknown");
        return null;
      });

      if (!graded) {
        return new Response(
          JSON.stringify({ error: "Grading is unavailable right now. Your work is saved — try again shortly." }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result = graded.result as {
        summary?: string;
        criteria?: Array<{ id?: string; score?: number; note?: string }>;
      };

      // The total is added up here, from the per-criterion scores, and each one
      // is capped at its own weight first. Asking the model for an overall
      // score as well would produce two numbers that disagree, and the wrong
      // one would be the one shown.
      const weights = new Map(criteria.map((c) => [c.id, Number(c.weight) || 0]));
      const marks = (result.criteria ?? [])
        .filter((c) => typeof c.id === "string" && weights.has(c.id))
        .map((c) => ({
          id: c.id as string,
          score: Math.max(0, Math.min(weights.get(c.id as string) ?? 0, Number(c.score) || 0)),
          note: typeof c.note === "string" ? c.note : "",
        }));
      const total = marks.reduce((sum, mark) => sum + mark.score, 0);

      const { data: stored } = await serviceClient.rpc("ivx_project_grade", {
        _user_id: user.id,
        _slug: slug,
        _score: total,
        _feedback: { summary: result.summary ?? "", criteria: marks },
      });

      return new Response(
        JSON.stringify({
          ok: true,
          score: (stored as { score?: number } | null)?.score ?? total,
          xp: (stored as { xp?: number } | null)?.xp ?? 0,
          feedback: { summary: result.summary ?? "", criteria: marks },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Resolve provider, model, and system prompt ─────────────────────
    let targets: ProviderTarget[] = [
      { provider: "groq", model: "llama-3.1-8b-instant" },
      { provider: "mistral", model: "mistral-small-latest" },
      { provider: "openai", model: "gpt-4.1" },
    ];
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
      targets = assistant.targets;
      systemPrompt = assistant.systemPrompt;
      if (context?.language) {
        systemPrompt += `\n\nUser's preferred language: ${context.language}. Respond in this language.`;
      }

      // ── The IVX tutor's brief ──────────────────────────────────────────
      //
      // Fetched here, with the service role, rather than sent by the browser.
      // The browser could not send it anyway: half of what the tutor needs —
      // the correct answer — is deliberately unreadable by any client, and the
      // other half (whether the question is still open) is exactly the sort of
      // claim a caller should not be trusted to make about itself.
      //
      // `ivx_tutor_brief` decides the mode from the student's own session and
      // attempt rows and withholds the answer while the question is open, so
      // an unanswered question cannot be talked out of the tutor.
      if (assistantId === "ivx-tutor" && user && serviceClient) {
        const questionId = typeof context?.ivxQuestionId === "string" ? context.ivxQuestionId : null;
        if (!questionId) {
          return new Response(
            JSON.stringify({ error: "ivxQuestionId is required for the IVX tutor" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: brief, error: briefError } = await serviceClient.rpc("ivx_tutor_brief", {
          _user_id: user.id,
          _question_id: questionId,
          _language: typeof context?.language === "string" ? context.language : "en",
        });

        const briefObject = (brief ?? null) as Record<string, unknown> | null;
        if (briefError || !briefObject?.ok) {
          // "not_your_question" is the common one, and it is not an error the
          // student caused — it is the tutor refusing to discuss a question
          // this account was never dealt.
          console.warn("[ai-chat] ivx tutor brief refused:", briefError?.message ?? briefObject?.reason);
          return new Response(
            JSON.stringify({ error: "This question is not open for tutoring.", reason: briefObject?.reason ?? "unavailable" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        systemPrompt += `\n\nQUESTION BRIEF (authoritative — everything you know about this question comes from here):\n${JSON.stringify(briefObject)}`;

        // The thread is recorded so WhatsApp and the site show the same
        // conversation, and so a student can read Tuesday's explanation again
        // on Friday. Only the student's turn is known at this point; the
        // reply is streamed, so the client records it when the stream ends.
        const lastStudentTurn = [...messages].reverse().find(
          (m: { role: string; content: string }) => m.role === "user",
        )?.content;
        if (lastStudentTurn) {
          await serviceClient.rpc("ivx_tutor_log", {
            _user_id: user.id,
            _question_id: questionId,
            _role: "student",
            _body: lastStudentTurn,
            _channel: "web",
          });
        }
      }
    } else if (context?.voiceMode) {
      // Voice mode: short, conversational, no markdown
      systemPrompt = `You are Visionex AI, a warm, friendly voice assistant for VisionEx, a global accessible platform for everyone.

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
        targets = [
          { provider: "groq", model: "llama-3.1-8b-instant" },
          { provider: "mistral", model: "mistral-small-latest" },
          { provider: "openai", model: "gpt-4.1" },
        ];
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
      const { result: stream } = await streamChatCompletionWithFallback({
        targets,
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
