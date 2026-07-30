import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type { AssessmentQuestion, TalentResult } from "@/features/visionkids/types/talent.types";

export async function fetchAssessmentQuestions(): Promise<AssessmentQuestion[]> {
  const { data, error } = await kidsDb
    .from("kids_talent_assessment_questions").select("*").eq("status", "published").order("order_index")
    .returns<AssessmentQuestion[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchMyTalentResult(): Promise<TalentResult | null> {
  const { data: authData } = await kidsDb.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) return null;
  const { data, error } = await kidsDb
    .from("kids_talent_results").select("*").eq("user_id", userId).maybeSingle()
    .returns<TalentResult>();
  if (error) throw error;
  return data ?? null;
}

/** Sum the picked options' weight maps into per-domain scores, take the top
 *  3 domains, and persist via the SECURITY DEFINER RPC (which also grants
 *  first-time XP). Returns whether this was the child's first assessment. */
export async function submitAssessment(
  questions: AssessmentQuestion[],
  answers: Record<string, string>,
): Promise<{ scores: Record<string, number>; topDomains: string[]; isFirst: boolean }> {
  const scores: Record<string, number> = {};
  for (const q of questions) {
    const chosenId = answers[q.id];
    const opt = q.options.find((o) => o.id === chosenId);
    if (!opt) continue;
    for (const [domain, weight] of Object.entries(opt.weights)) {
      scores[domain] = (scores[domain] ?? 0) + weight;
    }
  }
  const topDomains = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([domain]) => domain);

  const { data, error } = await kidsDb.rpc("submit_kids_talent_assessment", {
    _domain_scores: scores,
    _top_domains: topDomains,
  });
  if (error) throw error;
  return { scores, topDomains, isFirst: !!data };
}
