// ─── Library — Book Clubs (Phase 12: Reading Community) ───────────────────
// Membership writes (join/leave/invite/approve/role/ban) all go through
// SECURITY DEFINER RPCs — see the migration header on library_club_members
// for why direct client inserts aren't allowed.

import { supabase } from "@/integrations/supabase/client";

export type LibraryClubVisibility = "public" | "private" | "invite_only";
export type LibraryClubMemberRole = "owner" | "moderator" | "member";
export type LibraryClubMemberStatus = "active" | "invited" | "requested" | "banned";

export interface LibraryClubRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  cover_image_url: string | null;
  visibility: LibraryClubVisibility;
  rules: string | null;
  owner_id: string;
  member_count: number;
  is_active: boolean;
  created_at: string;
}

const CLUB_SELECT = "id, name, slug, description, cover_image_url, visibility, rules, owner_id, member_count, is_active, created_at";

export async function fetchClubs(query = ""): Promise<LibraryClubRow[]> {
  let q = supabase.from("library_clubs").select(CLUB_SELECT).eq("is_active", true).order("member_count", { ascending: false });
  if (query.trim()) q = q.ilike("name", `%${query.trim()}%`);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryClubRow[];
}

export async function fetchMyClubs(userId: string): Promise<LibraryClubRow[]> {
  const { data, error } = await supabase
    .from("library_club_members")
    .select("library_clubs(" + CLUB_SELECT + ")")
    .eq("user_id", userId)
    .eq("status", "active");
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<{ library_clubs: LibraryClubRow | null }>).map((r) => r.library_clubs).filter((c): c is LibraryClubRow => !!c);
}

export async function fetchClubBySlug(slug: string): Promise<LibraryClubRow | null> {
  const { data, error } = await supabase.from("library_clubs").select(CLUB_SELECT).eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  return data as LibraryClubRow | null;
}

function slugify(input: string): string {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || crypto.randomUUID().slice(0, 8);
}

export interface LibraryClubInput {
  name: string;
  description: string | null;
  visibility: LibraryClubVisibility;
  rules: string | null;
}

export async function createClub(ownerId: string, input: LibraryClubInput): Promise<LibraryClubRow> {
  const baseSlug = slugify(input.name);
  const slug = `${baseSlug}-${crypto.randomUUID().slice(0, 6)}`;
  const { data, error } = await supabase.from("library_clubs").insert({ ...input, owner_id: ownerId, slug }).select(CLUB_SELECT).single();
  if (error) throw new Error(error.message);
  return data as LibraryClubRow;
}

export async function updateClub(clubId: string, input: Partial<LibraryClubInput>): Promise<void> {
  const { error } = await supabase.from("library_clubs").update(input).eq("id", clubId);
  if (error) throw new Error(error.message);
}

export async function deleteClub(clubId: string): Promise<void> {
  const { error } = await supabase.from("library_clubs").delete().eq("id", clubId);
  if (error) throw new Error(error.message);
}

export interface LibraryClubMemberRow {
  user_id: string;
  role: LibraryClubMemberRole;
  status: LibraryClubMemberStatus;
  joined_at: string;
  displayName: string;
  avatarUrl: string | null;
}

export async function fetchClubMembers(clubId: string): Promise<LibraryClubMemberRow[]> {
  const { data, error } = await supabase.from("library_club_members").select("user_id, role, status, joined_at").eq("club_id", clubId).order("joined_at");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{ user_id: string; role: LibraryClubMemberRole; status: LibraryClubMemberStatus; joined_at: string }>;
  if (rows.length === 0) return [];
  const { data: names, error: nameErr } = await supabase.rpc("get_library_public_profile_summaries", { _user_ids: rows.map((r) => r.user_id) });
  if (nameErr) throw new Error(nameErr.message);
  const nameMap = new Map((names ?? []).map((n: { user_id: string; display_name: string | null; avatar_url: string | null }) => [n.user_id, n]));
  return rows.map((r) => ({
    ...r,
    displayName: nameMap.get(r.user_id)?.display_name ?? "Reader",
    avatarUrl: nameMap.get(r.user_id)?.avatar_url ?? null,
  }));
}

export async function fetchMyClubMembership(clubId: string, userId: string): Promise<LibraryClubMemberRow | null> {
  const { data, error } = await supabase.from("library_club_members").select("user_id, role, status, joined_at").eq("club_id", clubId).eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { ...data, displayName: "", avatarUrl: null };
}

export async function joinClub(clubId: string): Promise<LibraryClubMemberStatus> {
  const { data, error } = await supabase.rpc("join_library_club", { _club_id: clubId });
  if (error) throw new Error(error.message);
  return data as LibraryClubMemberStatus;
}

export async function leaveClub(clubId: string): Promise<void> {
  const { error } = await supabase.rpc("leave_library_club", { _club_id: clubId });
  if (error) throw new Error(error.message);
}

export async function inviteToClub(clubId: string, email: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("invite_to_library_club", { _club_id: clubId, _email: email });
  if (error) throw new Error(error.message);
  return data as boolean;
}

export async function respondToClubInvite(clubId: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc("respond_to_library_club_invite", { _club_id: clubId, _accept: accept });
  if (error) throw new Error(error.message);
}

export async function approveClubJoinRequest(clubId: string, userId: string, approve: boolean): Promise<void> {
  const { error } = await supabase.rpc("approve_library_club_join_request", { _club_id: clubId, _user_id: userId, _approve: approve });
  if (error) throw new Error(error.message);
}

export async function setClubMemberRole(clubId: string, userId: string, role: "moderator" | "member"): Promise<void> {
  const { error } = await supabase.rpc("set_library_club_member_role", { _club_id: clubId, _user_id: userId, _role: role });
  if (error) throw new Error(error.message);
}

export async function setClubMemberBan(clubId: string, userId: string, banned: boolean): Promise<void> {
  const { error } = await supabase.rpc("set_library_club_member_ban", { _club_id: clubId, _user_id: userId, _banned: banned });
  if (error) throw new Error(error.message);
}
