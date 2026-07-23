// ─── Library — Book Collaborators Service (Phase 9) ───────────────────────
// Wraps library_book_collaborators. Invites are created against an email —
// they become 'active' the first time that person signs in and the app
// links their user_id (see useCollaborators.ts's claim-on-login flow).

import { supabase } from "@/integrations/supabase/client";
import type { LibraryBookCollaboratorRow, LibraryCollaboratorRole } from "@/lib/types/library-studio";

const COLLABORATOR_SELECT = "id, book_id, user_id, invited_email, role, status, invited_by, created_at, updated_at";

export async function fetchCollaborators(bookId: string): Promise<LibraryBookCollaboratorRow[]> {
  const { data, error } = await supabase
    .from("library_book_collaborators")
    .select(COLLABORATOR_SELECT)
    .eq("book_id", bookId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryBookCollaboratorRow[];
}

export async function inviteCollaborator(bookId: string, invitedBy: string, email: string, role: LibraryCollaboratorRole): Promise<void> {
  const { error } = await supabase.from("library_book_collaborators").insert({
    book_id: bookId,
    invited_email: email.trim().toLowerCase(),
    role,
    status: "invited",
    invited_by: invitedBy,
  });
  if (error) throw new Error(error.message);
}

export async function updateCollaboratorRole(collaboratorId: string, role: LibraryCollaboratorRole): Promise<void> {
  const { error } = await supabase.from("library_book_collaborators").update({ role }).eq("id", collaboratorId);
  if (error) throw new Error(error.message);
}

export async function revokeCollaborator(collaboratorId: string): Promise<void> {
  const { error } = await supabase.from("library_book_collaborators").update({ status: "revoked" }).eq("id", collaboratorId);
  if (error) throw new Error(error.message);
}

/** Claims any pending invitations addressed to the signed-in user's email —
 *  called once on sign-in (see useCollaborators.ts) so an invited-by-email
 *  row becomes an active, user_id-linked membership the moment that person
 *  has an account. Allowed by the "library_book_collaborators: invited user
 *  claims own by email" RLS policy (auth.email() must match invited_email),
 *  not the owner/admin-manage policy — a plain client update, no RPC. */
export async function claimPendingInvitations(userId: string, email: string): Promise<void> {
  const { error } = await supabase
    .from("library_book_collaborators")
    .update({ user_id: userId, status: "active" })
    .eq("invited_email", email.trim().toLowerCase())
    .eq("status", "invited")
    .is("user_id", null);
  if (error) throw new Error(error.message);
}

export async function fetchMyCollaborations(userId: string): Promise<LibraryBookCollaboratorRow[]> {
  const { data, error } = await supabase
    .from("library_book_collaborators")
    .select(COLLABORATOR_SELECT)
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryBookCollaboratorRow[];
}
