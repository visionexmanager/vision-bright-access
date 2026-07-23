// ─── Library — Reader Settings Service (Phase 6) ──────────────────────────
// Wraps library_reader_settings (20260724000000_library_reader_engine.sql)
// — one row per user, RLS `user manages own`.

import { supabase } from "@/integrations/supabase/client";
import type { LibraryReaderSettings } from "@/lib/types/library-reader";

export async function fetchReaderSettings(userId: string): Promise<LibraryReaderSettings | null> {
  const { data, error } = await supabase.from("library_reader_settings").select("settings").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? (data.settings as unknown as LibraryReaderSettings) : null;
}

export async function saveReaderSettings(userId: string, settings: LibraryReaderSettings): Promise<void> {
  const { error } = await supabase.from("library_reader_settings").upsert({ user_id: userId, settings: settings as unknown as Record<string, unknown> }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}
