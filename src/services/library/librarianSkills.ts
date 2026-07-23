// ─── Library — AI Personal Librarian: Skills ───────────────────────────────

import { supabase } from "@/integrations/supabase/client";

export type LibrarySkillLevel = "beginner" | "intermediate" | "advanced" | "expert";
export type LibrarySkillSource = "manual" | "certificate" | "course";

export interface LibrarySkillRow {
  id: string;
  user_id: string;
  skill_name: string;
  proficiency_level: LibrarySkillLevel;
  source: LibrarySkillSource;
  related_certificate_id: string | null;
  related_course_id: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchSkills(userId: string): Promise<LibrarySkillRow[]> {
  const { data, error } = await supabase
    .from("library_skills").select("*").eq("user_id", userId).order("skill_name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as LibrarySkillRow[];
}

export async function addSkill(userId: string, skillName: string, level: LibrarySkillLevel = "beginner"): Promise<LibrarySkillRow> {
  const { data, error } = await supabase
    .from("library_skills")
    .insert({ user_id: userId, skill_name: skillName, proficiency_level: level, source: "manual" })
    .select("*").single();
  if (error) throw new Error(error.message);
  return data as LibrarySkillRow;
}

export async function updateSkillLevel(skillId: string, level: LibrarySkillLevel): Promise<void> {
  const { error } = await supabase.from("library_skills").update({ proficiency_level: level }).eq("id", skillId);
  if (error) throw new Error(error.message);
}

export async function removeSkill(skillId: string): Promise<void> {
  const { error } = await supabase.from("library_skills").delete().eq("id", skillId);
  if (error) throw new Error(error.message);
}
