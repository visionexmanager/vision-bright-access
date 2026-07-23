// ─── Library — AI Personal Librarian: Privacy Dashboard ────────────────────

import { supabase } from "@/integrations/supabase/client";

export type LibraryPrivacyCategory =
  | "highlights" | "notes" | "bookmarks" | "chat_history" | "recommendations"
  | "daily_plans" | "summaries" | "goals" | "favorite_topics";

export interface LibraryLibrarianDataRequestRow {
  id: string;
  user_id: string;
  request_type: "export" | "delete_all" | "delete_category" | "pause" | "resume";
  category: string | null;
  status: "pending" | "completed" | "failed";
  created_at: string;
  completed_at: string | null;
}

export async function fetchDataRequests(userId: string): Promise<LibraryLibrarianDataRequestRow[]> {
  const { data, error } = await supabase
    .from("library_librarian_data_requests").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryLibrarianDataRequestRow[];
}

async function invokePrivacyAction(action: string, category?: LibraryPrivacyCategory): Promise<{ data?: Record<string, unknown> }> {
  const { data, error } = await supabase.functions.invoke("library-librarian-privacy", { body: { action, category } });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function exportMemory(): Promise<Record<string, unknown>> {
  const result = await invokePrivacyAction("export");
  return result.data ?? {};
}

export async function deleteMemoryCategory(category: LibraryPrivacyCategory): Promise<void> {
  await invokePrivacyAction("delete_category", category);
}

export async function deleteAllMemory(): Promise<void> {
  await invokePrivacyAction("delete_all");
}

export async function pauseMemory(): Promise<void> {
  await invokePrivacyAction("pause");
}

export async function resumeMemory(): Promise<void> {
  await invokePrivacyAction("resume");
}

export function downloadMemoryExport(bundle: Record<string, unknown>) {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `visionex-library-data-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
