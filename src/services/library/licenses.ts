// ─── Library — Licenses Service (Phase 10) ────────────────────────────────
// Corporate/educational/family-sharing seats. License rows themselves are
// created only by library-checkout-session (service-role) — this file is
// read + seat-management only.

import { supabase } from "@/integrations/supabase/client";
import type { LibraryLicenseRow, LibraryLicenseSeatRow } from "@/lib/types/library-marketplace";

export async function fetchMyLicenses(userId: string): Promise<LibraryLicenseRow[]> {
  const { data, error } = await supabase
    .from("library_licenses")
    .select("id, book_id, purchaser_id, license_type, seat_count, created_at")
    .eq("purchaser_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryLicenseRow[];
}

export async function fetchLicenseSeats(licenseId: string): Promise<LibraryLicenseSeatRow[]> {
  const { data, error } = await supabase.from("library_license_seats").select("license_id, user_id, invited_email, status").eq("license_id", licenseId);
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryLicenseSeatRow[];
}

export async function inviteLicenseSeat(licenseId: string, email: string): Promise<void> {
  const { error } = await supabase.from("library_license_seats").insert({ license_id: licenseId, invited_email: email.trim().toLowerCase() });
  if (error) throw new Error(error.message);
}

export async function revokeLicenseSeat(licenseId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("library_license_seats").update({ status: "revoked" }).eq("license_id", licenseId).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

/** Claims any pending seat invitations addressed to the signed-in user's
 *  email — same pattern as claimPendingInvitations in collaborators.ts. */
export async function claimPendingLicenseSeats(userId: string, email: string): Promise<void> {
  const { error } = await supabase
    .from("library_license_seats")
    .update({ user_id: userId, status: "active" })
    .eq("invited_email", email.trim().toLowerCase())
    .eq("status", "invited")
    .is("user_id", null);
  if (error) throw new Error(error.message);
}
