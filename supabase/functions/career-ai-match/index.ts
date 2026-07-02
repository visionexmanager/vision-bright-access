// POST /api/ai/match — AI Job Matching Engine, scored against the real
// `jobs`/`career_profiles` tables (not free text), so the match reflects
// what's actually posted and what the candidate actually has on file.
//
// Input:
//   { jobId: string }              — match the caller's own profile against a specific job
//   { jobId: string, candidateId } — employer matching a specific candidate against their job
//   { input: string }              — fallback: free-text matching when no job/profile row applies
import { getCorsHeaders } from "../_shared/cors.ts";
import { authenticateCareerAiRequest, json } from "../_shared/careerAiHandler.ts";
import { runStructuredCareerAI } from "../_shared/careerAiOrchestrator.ts";
import { CAREER_AI_RESPONSE_SCHEMA, getCareerAiPrompt } from "../_shared/careerPrompts.ts";
import { validateAndCleanInput } from "../_shared/careerAiSafety.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await authenticateCareerAiRequest(req);
  if (!auth.ok) return auth.response;
  const { user, serviceClient, body } = auth.value;

  try {
    const jobId = typeof body.jobId === "string" ? body.jobId : null;
    const candidateId = typeof body.candidateId === "string" ? body.candidateId : null;
    let role: "candidate" | "employer" = "candidate";
    let userText: string;

    if (jobId) {
      const { data: job, error: jobErr } = await serviceClient
        .from("jobs")
        .select("id, title, description, location, salary_min, salary_max, job_type, remote, experience_level, skills_required, posted_by, status")
        .eq("id", jobId)
        .maybeSingle();
      if (jobErr || !job) return json({ error: "Job not found" }, 404, corsHeaders);

      const isOwner = job.posted_by === user.id;
      // Mirrors the RLS rule on `jobs` (public.jobs SELECT policy): only the
      // poster or an active listing is visible. Using the service-role
      // client above bypasses RLS, so this check re-applies it explicitly.
      if (job.status !== "active" && !isOwner) {
        return json({ error: "Job not found" }, 404, corsHeaders);
      }

      const isEmployerView = isOwner && Boolean(candidateId);
      role = isEmployerView ? "employer" : "candidate";

      const profileUserId = isEmployerView ? candidateId! : user.id;
      const { data: profile } = await serviceClient
        .from("career_profiles")
        .select("headline, bio, location, skills, years_experience")
        .eq("user_id", profileUserId)
        .maybeSingle();

      userText = [
        `Job posting:`,
        `- Title: ${job.title}`,
        `- Description: ${job.description}`,
        job.location ? `- Location: ${job.location}` : "",
        `- Type: ${job.job_type}${job.remote ? " (remote)" : ""}`,
        `- Experience level: ${job.experience_level}`,
        job.skills_required?.length ? `- Required skills: ${job.skills_required.join(", ")}` : "",
        (job.salary_min || job.salary_max) ? `- Salary range: ${job.salary_min ?? "?"}-${job.salary_max ?? "?"}` : "",
        ``,
        `Candidate profile:`,
        profile?.headline ? `- Headline: ${profile.headline}` : "- (no headline on file)",
        profile?.location ? `- Location: ${profile.location}` : "",
        typeof profile?.years_experience === "number" ? `- Years of experience: ${profile.years_experience}` : "",
        profile?.skills?.length ? `- Skills: ${profile.skills.join(", ")}` : "- (no skills on file)",
        profile?.bio ? `- Bio: ${profile.bio}` : "",
      ].filter(Boolean).join("\n");
    } else {
      const input = typeof body.input === "string" ? body.input : "";
      const validation = validateAndCleanInput(input);
      if (!validation.ok) return json({ error: validation.reason }, 400, corsHeaders);
      userText = validation.cleaned;
    }

    const prompt = getCareerAiPrompt("match", role);
    const result = await runStructuredCareerAI({
      supabase: serviceClient,
      service: "match",
      userId: user.id,
      system: prompt.system,
      userText,
      schema: CAREER_AI_RESPONSE_SCHEMA,
      toolName: "career_ai_result",
      cacheTtlSeconds: body.noCache === true ? 0 : undefined,
    });

    return json({ ...result.response, meta: result.meta }, 200, corsHeaders);
  } catch (e) {
    console.error("career-ai-match error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500, corsHeaders);
  }
});
