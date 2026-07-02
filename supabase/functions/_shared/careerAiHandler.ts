// Shared request handling for the Career Center AI endpoints: auth,
// per-user rate limiting, and JSON response helpers, reused by the generic
// structured-service handler below and by career-ai-match (which needs
// custom logic to pull real job/candidate rows from the DB).

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "./cors.ts";
import { CostTier, runStructuredCareerAI } from "./careerAiOrchestrator.ts";
import { CAREER_AI_RESPONSE_SCHEMA, CareerAiRole, CareerAiService, getCareerAiPrompt } from "./careerPrompts.ts";
import { buildUserAiContext } from "./careerAiMemory.ts";
import { checkRateLimit } from "./careerRateLimit.ts";
import { validateAndCleanInput } from "./careerAiSafety.ts";

// deno-lint-ignore no-explicit-any
type SupabaseServiceClient = any;

export function json(
  body: unknown,
  status: number,
  corsHeaders: Record<string, string>,
  extraHeaders?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, ...extraHeaders, "Content-Type": "application/json" },
  });
}

export interface AuthedCareerAiRequest {
  corsHeaders: Record<string, string>;
  user: { id: string };
  /** Anon-key client scoped to the caller's own auth token, respects RLS. */
  supabase: SupabaseServiceClient;
  /** Service-role client for privileged reads/writes (ai_interactions, ai_response_cache, cross-user job/profile lookups). */
  serviceClient: SupabaseServiceClient;
  body: Record<string, unknown>;
}

/** Verifies the caller's JWT and applies the shared per-user rate limit. Returns a ready-to-send Response on any failure. */
export async function authenticateCareerAiRequest(
  req: Request,
): Promise<{ ok: true; value: AuthedCareerAiRequest } | { ok: false; response: Response }> {
  const corsHeaders = getCorsHeaders(req);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return { ok: false, response: json({ error: "Unauthorized" }, 401, corsHeaders) };

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return { ok: false, response: json({ error: "Unauthorized" }, 401, corsHeaders) };

  const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const rate = await checkRateLimit(serviceClient, user.id);
  if (!rate.allowed) {
    return {
      ok: false,
      response: json(
        { error: "Rate limit exceeded. Please try again shortly." },
        429,
        corsHeaders,
        rate.retryAfterSeconds ? { "Retry-After": String(rate.retryAfterSeconds) } : undefined,
      ),
    };
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  return { ok: true, value: { corsHeaders, user, supabase, serviceClient, body } };
}

export interface StructuredServiceOptions {
  service: CareerAiService;
  tier?: CostTier;
}

// Services that can run purely off the caller's stored profile/goals context
// (health_score, coach) get a default prompt when `input` is omitted, rather
// than failing — the others genuinely need real user-supplied text.
const DEFAULT_INPUT_BY_SERVICE: Partial<Record<CareerAiService, string>> = {
  health_score: "Assess my current career health based on my profile, goals, and recent activity.",
  coach: "Give me general career guidance based on my current profile and goals.",
};

/**
 * Generic handler for the 8 structured services that just take a free-text
 * `input` (resume/analyze/coach/roadmap/visa/salary/interview/health_score).
 * career-ai-match has its own handler since it pulls real job/profile rows.
 */
export async function handleStructuredCareerAiRequest(
  req: Request,
  opts: StructuredServiceOptions,
): Promise<Response> {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await authenticateCareerAiRequest(req);
  if (!auth.ok) return auth.response;
  const { user, serviceClient, body } = auth.value;

  try {
    const rawInput = typeof body.input === "string" ? body.input : "";
    const input = rawInput.trim().length > 0 ? rawInput : (DEFAULT_INPUT_BY_SERVICE[opts.service] ?? "");
    const role: CareerAiRole = body.role === "employer" || body.role === "mentor" ? body.role : "candidate";

    const validation = validateAndCleanInput(input);
    if (!validation.ok) return json({ error: validation.reason }, 400, corsHeaders);

    const memoryContext = await buildUserAiContext(serviceClient, user.id);
    const prompt = getCareerAiPrompt(opts.service, role);
    const userText = memoryContext.contextText
      ? `${validation.cleaned}\n\n---\nKnown user context:\n${memoryContext.contextText}`
      : validation.cleaned;

    const result = await runStructuredCareerAI({
      supabase: serviceClient,
      service: opts.service,
      userId: user.id,
      system: prompt.system,
      userText,
      image: typeof body.image === "string" ? body.image : undefined,
      schema: CAREER_AI_RESPONSE_SCHEMA,
      toolName: "career_ai_result",
      tier: opts.tier,
      cacheTtlSeconds: body.noCache === true ? 0 : undefined,
    });

    return json({ ...result.response, meta: result.meta }, 200, corsHeaders);
  } catch (e) {
    console.error(`career-ai-${opts.service} error:`, e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500, corsHeaders);
  }
}
