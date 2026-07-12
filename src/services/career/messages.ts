// ─── Career Center — Messages Service (Phase 1 backend) ──────────────────────
// Table: messages (candidate ↔ employer/mentor DMs — distinct from the
// site-wide conversations/direct_messages table used elsewhere in the app).
// RLS: only sender or recipient can see a row; only the recipient can mark
// read; no "list conversations" query exists server-side, so we fetch every
// row the user participates in and group client-side.

import { supabase } from "@/integrations/supabase/client";
import type { CareerMessageRow } from "@/lib/types/career";

export async function fetchMyCareerMessages(userId: string): Promise<CareerMessageRow[]> {
  const { data, error } = await (supabase.from("messages") as any)
    .select("*")
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as CareerMessageRow[];
}

export async function sendCareerMessage(senderId: string, recipientId: string, body: string): Promise<CareerMessageRow> {
  const { data, error } = await (supabase.from("messages") as any)
    .insert({ sender_id: senderId, recipient_id: recipientId, body })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as CareerMessageRow;
}

export async function markCareerMessageRead(messageId: string): Promise<void> {
  const { error } = await (supabase.from("messages") as any)
    .update({ is_read: true })
    .eq("id", messageId);
  if (error) throw new Error(error.message);
}
