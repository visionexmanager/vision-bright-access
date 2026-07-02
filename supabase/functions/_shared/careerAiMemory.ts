// Context memory for the Career Center AI layer: builds a compact,
// per-user context block (skills, goals, recent AI activity) that gets
// injected into prompts for personalization, and a GDPR-style deletion
// helper that erases a user's stored AI memory on request.

// deno-lint-ignore no-explicit-any
type SupabaseServiceClient = any;

export interface CareerAiUserContext {
  /** Plain-text block ready to append to a prompt's user message. Empty string if the user has no stored context yet. */
  contextText: string;
  hasProfile: boolean;
}

/**
 * Pulls the minimum signal needed for personalization: the candidate's
 * profile (skills/headline/experience/location), active career goals, and a
 * short trail of recent AI interaction summaries. Every field is optional —
 * a brand-new user still gets a valid (empty) context, not an error.
 */
export async function buildUserAiContext(
  supabase: SupabaseServiceClient,
  userId: string | null,
): Promise<CareerAiUserContext> {
  if (!userId) return { contextText: "", hasProfile: false };

  const [{ data: profile }, { data: goals }, { data: recentInteractions }] = await Promise.all([
    supabase
      .from("career_profiles")
      .select("headline, bio, location, skills, years_experience")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("career_goals")
      .select("title, priority, progress, deadline")
      .eq("user_id", userId)
      .order("priority", { ascending: false })
      .limit(5),
    supabase
      .from("ai_interactions")
      .select("service, request_summary, response_summary, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const lines: string[] = [];

  if (profile) {
    lines.push("Candidate profile:");
    if (profile.headline) lines.push(`- Headline: ${profile.headline}`);
    if (profile.location) lines.push(`- Location: ${profile.location}`);
    if (typeof profile.years_experience === "number") {
      lines.push(`- Years of experience: ${profile.years_experience}`);
    }
    if (Array.isArray(profile.skills) && profile.skills.length > 0) {
      lines.push(`- Skills: ${profile.skills.join(", ")}`);
    }
    if (profile.bio) lines.push(`- Bio: ${profile.bio}`);
  }

  if (Array.isArray(goals) && goals.length > 0) {
    lines.push("Active career goals:");
    for (const g of goals) {
      const deadline = g.deadline ? ` (deadline ${g.deadline})` : "";
      lines.push(`- [${g.priority}] ${g.title} — ${g.progress}% complete${deadline}`);
    }
  }

  if (Array.isArray(recentInteractions) && recentInteractions.length > 0) {
    lines.push("Recent AI activity (most recent first):");
    for (const i of recentInteractions) {
      if (i.response_summary) lines.push(`- ${i.service}: ${i.response_summary}`);
    }
  }

  return { contextText: lines.join("\n"), hasProfile: Boolean(profile) };
}

/**
 * GDPR-ready memory deletion: erases this user's AI interaction history.
 * career_profiles / career_goals are the user's own records already
 * governed by their existing owner-only RLS policies and are left untouched
 * here — this only clears AI-derived memory, not the user's own data.
 */
export async function deleteUserAiMemory(
  supabase: SupabaseServiceClient,
  userId: string,
): Promise<void> {
  const { error } = await supabase.from("ai_interactions").delete().eq("user_id", userId);
  if (error) throw error;
}
