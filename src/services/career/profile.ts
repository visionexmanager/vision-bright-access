// ─── Career Center — Profile Service (Phase 1 backend) ────────────────────────
// Tables: career_profiles (career-specific fields) + the site-wide `profiles`
// table (display_name/avatar_url — career_profiles has no name column of its
// own, same split as the rest of the app). Storage: career-resumes bucket.
// RLS enforces ownership server-side.

import { supabase } from "@/integrations/supabase/client";
import type { CareerProfileRow } from "@/lib/types/career";

export interface CareerProfileWithName extends CareerProfileRow {
  display_name: string | null;
  base_avatar_url: string | null;
}

export async function fetchMyCareerProfile(userId: string): Promise<CareerProfileWithName | null> {
  const [{ data: careerRow, error: careerErr }, { data: baseRow, error: baseErr }] = await Promise.all([
    (supabase.from("career_profiles") as any).select("*").eq("user_id", userId).maybeSingle(),
    (supabase.from("profiles") as any).select("display_name, avatar_url").eq("user_id", userId).maybeSingle(),
  ]);
  if (careerErr) throw new Error(careerErr.message);
  if (baseErr) throw new Error(baseErr.message);
  if (!careerRow) return null;

  return {
    ...(careerRow as CareerProfileRow),
    display_name: baseRow?.display_name ?? null,
    base_avatar_url: baseRow?.avatar_url ?? null,
  };
}

export interface CareerProfilePatch {
  headline?: string;
  bio?: string;
  location?: string;
  github_url?: string;
  linkedin_url?: string;
  portfolio_url?: string;
  website_url?: string;
  skills?: string[];
  languages?: string[];
}

export async function upsertCareerProfile(userId: string, patch: CareerProfilePatch): Promise<CareerProfileRow> {
  const { data, error } = await (supabase.from("career_profiles") as any)
    .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as CareerProfileRow;
}

/** Batch-resolve display names for a set of user ids (e.g. message senders/recipients). */
export async function fetchDisplayNames(userIds: string[]): Promise<Record<string, string>> {
  const uniqueIds = [...new Set(userIds)].filter(Boolean);
  if (uniqueIds.length === 0) return {};
  const { data, error } = await (supabase.from("profiles") as any)
    .select("user_id, display_name")
    .in("user_id", uniqueIds);
  if (error) throw new Error(error.message);
  const map: Record<string, string> = {};
  for (const row of (data ?? []) as { user_id: string; display_name: string | null }[]) {
    map[row.user_id] = row.display_name ?? "";
  }
  return map;
}

export async function uploadResume(userId: string, file: File): Promise<string> {
  const path = `${userId}/${Date.now()}-${file.name}`;
  const { error: uploadErr } = await supabase.storage.from("career-resumes").upload(path, file, { upsert: true });
  if (uploadErr) throw new Error(uploadErr.message);

  const { data: signed, error: signErr } = await supabase.storage
    .from("career-resumes")
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  if (signErr) throw new Error(signErr.message);

  const resumeUrl = signed.signedUrl;
  const { error: updateErr } = await (supabase.from("career_profiles") as any)
    .upsert({ user_id: userId, resume_url: resumeUrl }, { onConflict: "user_id" });
  if (updateErr) throw new Error(updateErr.message);

  return resumeUrl;
}
