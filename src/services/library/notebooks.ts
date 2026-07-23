// ─── Library — Learning Hub: Notebooks (organization for Smart Notes) ──────

import { supabase } from "@/integrations/supabase/client";
import type { LibraryNotebookRow } from "@/lib/types/library-learning";

export async function fetchNotebooks(userId: string): Promise<LibraryNotebookRow[]> {
  const { data, error } = await supabase.from("library_notebooks").select("*").eq("user_id", userId).order("order_index");
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryNotebookRow[];
}

export async function createNotebook(userId: string, name: string, color = "blue", icon: string | null = null): Promise<LibraryNotebookRow> {
  const { data, error } = await supabase
    .from("library_notebooks").insert({ user_id: userId, name, color, icon }).select("*").single();
  if (error) throw new Error(error.message);
  return data as LibraryNotebookRow;
}

export async function renameNotebook(notebookId: string, name: string): Promise<void> {
  const { error } = await supabase.from("library_notebooks").update({ name }).eq("id", notebookId);
  if (error) throw new Error(error.message);
}

export async function deleteNotebook(notebookId: string): Promise<void> {
  const { error } = await supabase.from("library_notebooks").delete().eq("id", notebookId);
  if (error) throw new Error(error.message);
}
