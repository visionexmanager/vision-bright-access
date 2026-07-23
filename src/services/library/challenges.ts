// ─── Library — Reading Challenges Service (Phase 3) ────────────────────────────
// Reads library_challenges (public, active-only) with each user's own
// library_challenge_progress embedded via PostgREST relation-embedding —
// RLS on library_challenge_progress ("user manages own") means the embedded
// relation naturally returns only the calling user's row (or none, for an
// anonymous visitor), no extra filtering needed here.

import { supabase } from "@/integrations/supabase/client";
import type { LibraryChallengeWithProgress } from "@/lib/types/library-home";

const CHALLENGE_SELECT = "id, title, description, goal_type, goal_target, starts_at, ends_at, reward_vx, is_active, scope, cadence, created_by, category_id, author_id, participant_count";

type ChallengeRow = {
  id: string;
  title: string;
  description: string | null;
  goal_type: string;
  goal_target: number;
  starts_at: string | null;
  ends_at: string | null;
  reward_vx: number;
  is_active: boolean;
  scope: string;
  cadence: string;
  created_by: string | null;
  category_id: string | null;
  author_id: string | null;
  participant_count: number;
  library_challenge_progress: { current_value: number; completed_at: string | null; challenge_id: string }[];
};

function mapChallenge(row: ChallengeRow): LibraryChallengeWithProgress {
  const progress = row.library_challenge_progress?.[0] ?? null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    goal_type: row.goal_type as LibraryChallengeWithProgress["goal_type"],
    goal_target: row.goal_target,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    reward_vx: row.reward_vx,
    is_active: row.is_active,
    scope: row.scope as LibraryChallengeWithProgress["scope"],
    cadence: row.cadence as LibraryChallengeWithProgress["cadence"],
    created_by: row.created_by,
    category_id: row.category_id,
    author_id: row.author_id,
    participant_count: row.participant_count,
    progress: progress ? { challenge_id: progress.challenge_id, current_value: progress.current_value, completed_at: progress.completed_at } : null,
  };
}

export async function fetchActiveChallenges(): Promise<LibraryChallengeWithProgress[]> {
  const { data, error } = await supabase
    .from("library_challenges")
    .select(`${CHALLENGE_SELECT}, library_challenge_progress(current_value, completed_at, challenge_id)`)
    .eq("is_active", true)
    .order("ends_at", { ascending: true, nullsFirst: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as ChallengeRow[]).map(mapChallenge);
}

export interface LibraryCustomChallengeInput {
  title: string;
  description: string | null;
  goal_type: LibraryChallengeWithProgress["goal_type"];
  goal_target: number;
  cadence: LibraryChallengeWithProgress["cadence"];
  scope: "community" | "custom";
  category_id: string | null;
  ends_at: string | null;
}

export async function createCustomChallenge(userId: string, input: LibraryCustomChallengeInput): Promise<void> {
  const { error } = await supabase.from("library_challenges").insert({ ...input, created_by: userId, starts_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

/** Joining a challenge = creating a zero-progress row for yourself — the
 *  existing per-challenge triggers/reward flow take over from there. */
export async function joinChallenge(userId: string, challengeId: string): Promise<void> {
  const { error } = await supabase.from("library_challenge_progress").insert({ user_id: userId, challenge_id: challengeId, current_value: 0 });
  if (error) throw new Error(error.message);
}
