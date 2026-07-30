import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type { Skill, SkillProgress } from "@/features/visionkids/types/talent.types";

export async function fetchSkills(): Promise<Skill[]> {
  const { data, error } = await kidsDb
    .from("kids_skills").select("*").eq("status", "published").order("tier").order("order_index")
    .returns<Skill[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchMySkillProgress(): Promise<SkillProgress[]> {
  const { data: authData } = await kidsDb.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) return [];
  const { data, error } = await kidsDb
    .from("kids_skill_progress").select("*").eq("user_id", userId)
    .returns<SkillProgress[]>();
  if (error) throw error;
  return data ?? [];
}

/** Master a skill. Server enforces prerequisites and awards XP/coins/badge
 *  exactly once. Returns true only on a fresh mastery. */
export async function completeSkill(skillSlug: string): Promise<boolean> {
  const { data, error } = await kidsDb.rpc("complete_kids_skill", { _skill_slug: skillSlug });
  if (error) throw error;
  return !!data;
}
