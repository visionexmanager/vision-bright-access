// ─── Library — Enterprise Platform: AI Admin Features ─────────────────────
// Content recommendations + training plans (LLM) and duplicate detection
// (deterministic) via organization-ai-admin. Automatic Classification and
// Smart Search intentionally reuse the EXISTING library-ai-classify-book /
// library-ai-search functions directly — see buildKnowledgeGraphForBook-
// style precedent of not re-wrapping a function that already does the job.

import { supabase } from "@/integrations/supabase/client";

export interface DuplicateResourceGroup {
  duplicate_groups: { id: string; title: string }[][];
}

export async function detectDuplicateResources(orgId: string): Promise<DuplicateResourceGroup> {
  const { data, error } = await supabase.functions.invoke("organization-ai-admin", { body: { organization_id: orgId, mode: "duplicate_detection" } });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data.result as DuplicateResourceGroup;
}

export interface ContentRecommendationResult {
  summary: string;
  suggested_topics: string[];
}

export async function generateContentRecommendations(orgId: string): Promise<ContentRecommendationResult> {
  const { data, error } = await supabase.functions.invoke("organization-ai-admin", { body: { organization_id: orgId, mode: "content_recommendations" } });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data.result as ContentRecommendationResult;
}

export interface TrainingPlanResult {
  plan_summary: string;
  weekly_focus: string[];
  recommended_resource_titles: string[];
}

export async function generateTrainingPlan(orgId: string, groupId: string): Promise<TrainingPlanResult> {
  const { data, error } = await supabase.functions.invoke("organization-ai-admin", { body: { organization_id: orgId, mode: "training_plan", group_id: groupId } });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data.result as TrainingPlanResult;
}
