// ─── Library — Narrators Service (Phase 7) ────────────────────────────────
// Mirrors authors.ts's shape exactly. Stats (book count, rating) are NOT
// selected columns on library_narrators — they're computed on demand via
// the get_library_narrator_stats() RPC, see fetchNarratorStats below.

import { supabase } from "@/integrations/supabase/client";
import type { LibraryNarratorRow, LibraryNarratorStats } from "@/lib/types/library-narrator";

const NARRATOR_SELECT = "id, user_id, name, bio, photo_url, languages, created_at";

export async function fetchNarrators(limit = 50): Promise<LibraryNarratorRow[]> {
  const { data, error } = await supabase.from("library_narrators").select(NARRATOR_SELECT).order("name", { ascending: true }).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryNarratorRow[];
}

export async function fetchNarratorById(narratorId: string): Promise<LibraryNarratorRow | null> {
  const { data, error } = await supabase.from("library_narrators").select(NARRATOR_SELECT).eq("id", narratorId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as LibraryNarratorRow) ?? null;
}

export async function fetchNarratorStats(narratorId: string): Promise<LibraryNarratorStats> {
  const { data, error } = await supabase.rpc("get_library_narrator_stats", { _narrator_id: narratorId });
  if (error) throw new Error(error.message);
  return (data?.[0] as LibraryNarratorStats) ?? { book_count: 0, rating_avg: null, rating_count: 0 };
}
