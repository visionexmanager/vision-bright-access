// ─── Library — AI Personal Librarian: Smart Summaries ──────────────────────

import { supabase } from "@/integrations/supabase/client";

export type LibrarySummaryPeriod = "daily" | "weekly" | "monthly" | "yearly";

export interface LibraryLibrarianSummaryRow {
  id: string;
  user_id: string;
  summary_period: LibrarySummaryPeriod;
  period_start: string;
  period_end: string;
  reading_insights: string | null;
  learning_insights: string | null;
  skill_insights: string | null;
  summary_text: string | null;
  stats: Record<string, number>;
  generated_at: string;
}

export async function fetchSummaries(userId: string, period: LibrarySummaryPeriod): Promise<LibraryLibrarianSummaryRow[]> {
  const { data, error } = await supabase
    .from("library_librarian_summaries")
    .select("*")
    .eq("user_id", userId)
    .eq("summary_period", period)
    .order("period_start", { ascending: false })
    .limit(12);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as LibraryLibrarianSummaryRow[];
}

export async function generateSummary(period: LibrarySummaryPeriod): Promise<LibraryLibrarianSummaryRow> {
  const { data, error } = await supabase.functions.invoke("library-librarian-summary", { body: { period } });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data.summary as LibraryLibrarianSummaryRow;
}
