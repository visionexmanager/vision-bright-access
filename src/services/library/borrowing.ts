// ─── Library — Borrowing Service (Phase 5) ────────────────────────────────
// Unlike purchases, borrowing needs no edge function: library_borrowed_books
// RLS already lets a user manage their own rows directly
// (20260720000002_library_core_commerce_gamification.sql), and the
// BEFORE INSERT trigger check_library_lending_availability() enforces the
// copy limit server-side — a client-side insert can't oversell.

import { supabase } from "@/integrations/supabase/client";

const LOAN_PERIOD_DAYS = 14;

export interface LibraryBorrowRow {
  id: string;
  book_id: string;
  borrowed_at: string;
  due_at: string;
  returned_at: string | null;
  status: "active" | "returned" | "overdue";
}

/** The signed-in user's active (or most recent) borrow for a book, if any —
 *  powers "Borrow" vs "Return" vs "Due <date>" in the action bar. */
export async function fetchMyBorrowForBook(bookId: string, userId: string): Promise<LibraryBorrowRow | null> {
  const { data, error } = await supabase
    .from("library_borrowed_books")
    .select("id, book_id, borrowed_at, due_at, returned_at, status")
    .eq("book_id", bookId)
    .eq("user_id", userId)
    .eq("status", "active")
    .order("borrowed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as LibraryBorrowRow | null;
}

/** Borrows a book for the standard loan period. Throws (with the trigger's
 *  own message) if no copies are currently available. */
export async function borrowBook(bookId: string, userId: string): Promise<void> {
  const dueAt = new Date(Date.now() + LOAN_PERIOD_DAYS * 86_400_000).toISOString();
  const { error } = await supabase.from("library_borrowed_books").insert({ book_id: bookId, user_id: userId, due_at: dueAt });
  if (error) throw new Error(error.message);
}

export async function returnBorrowedBook(borrowId: string): Promise<void> {
  const { error } = await supabase.from("library_borrowed_books").update({ status: "returned", returned_at: new Date().toISOString() }).eq("id", borrowId);
  if (error) throw new Error(error.message);
}
