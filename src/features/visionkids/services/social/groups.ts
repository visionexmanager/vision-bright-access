import { supabase } from "@/integrations/supabase/client";
import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import { moderateKidsText } from "@/features/visionkids/utils/chatModeration";
import type {
  KidsSocialGroup, KidsSocialGroupMember, KidsSocialGroupMessage, KidsSocialGroupMaterial,
  KidsSocialGroupAssignment, KidsSocialGroupAssignmentSubmission, SocialGroupType,
} from "@/features/visionkids/types/social.types";

async function requireUserId(): Promise<string> {
  const { data } = await kidsDb.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error("Must be signed in");
  return id;
}

export async function fetchGroups(groupType?: SocialGroupType | SocialGroupType[]): Promise<KidsSocialGroup[]> {
  let query = kidsDb.from("kids_social_groups").select("*").eq("status", "active").order("created_at", { ascending: false });
  if (Array.isArray(groupType)) query = query.in("group_type", groupType);
  else if (groupType) query = query.eq("group_type", groupType);
  const { data, error } = await query.returns<KidsSocialGroup[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchGroupBySlug(slug: string): Promise<KidsSocialGroup | null> {
  const { data, error } = await kidsDb.from("kids_social_groups").select("*").eq("slug", slug).maybeSingle().returns<KidsSocialGroup>();
  if (error) throw error;
  return data ?? null;
}

export interface CreateGroupInput {
  groupType: SocialGroupType;
  name: string;
  description?: string;
  emoji?: string;
}

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "club";
}

export async function createGroup(input: CreateGroupInput): Promise<KidsSocialGroup> {
  const userId = await requireUserId();
  const slug = `${slugify(input.name)}-${Date.now().toString(36)}`;
  const { data, error } = await kidsDb
    .from("kids_social_groups")
    .insert({ group_type: input.groupType, slug, name: input.name, description: input.description ?? null, emoji: input.emoji ?? "👥", owner_id: userId })
    .select("*").single()
    .returns<KidsSocialGroup>();
  if (error) throw error;

  await kidsDb.rpc("award_kids_xp", { _amount: 15, _reason: `Club joined: ${data.id}` }).then(() => {}, () => {});
  await kidsDb.rpc("award_kids_achievement", { _key: "club_starter" }).then(() => {}, () => {});
  return data;
}

export async function fetchGroupMembers(groupId: string): Promise<KidsSocialGroupMember[]> {
  const { data, error } = await kidsDb.from("kids_social_group_members").select("*").eq("group_id", groupId).returns<KidsSocialGroupMember[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchMyGroupMemberships(): Promise<KidsSocialGroupMember[]> {
  const userId = await requireUserId();
  const { data, error } = await kidsDb.from("kids_social_group_members").select("*").eq("user_id", userId).returns<KidsSocialGroupMember[]>();
  if (error) throw error;
  return data ?? [];
}

export async function joinGroup(groupId: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await kidsDb.from("kids_social_group_members").insert({ group_id: groupId, user_id: userId });
  if (error) throw error;

  await kidsDb.rpc("award_kids_xp", { _amount: 15, _reason: `Club joined: ${groupId}` }).then(() => {}, () => {});
  await kidsDb.rpc("award_kids_achievement", { _key: "club_joiner" }).then(() => {}, () => {});
}

export async function leaveGroup(groupId: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await kidsDb.from("kids_social_group_members").delete().eq("group_id", groupId).eq("user_id", userId);
  if (error) throw error;
}

export async function fetchGroupMessages(groupId: string): Promise<KidsSocialGroupMessage[]> {
  const { data, error } = await kidsDb
    .from("kids_social_group_messages").select("*").eq("group_id", groupId).order("created_at")
    .returns<KidsSocialGroupMessage[]>();
  if (error) throw error;
  return data ?? [];
}

/** Same client-side-filter-first, async-AI-flag-after safety model as
 *  1:1 chat (services/social/chat.ts) — see that file's comment. */
export async function sendGroupMessage(groupId: string, rawText: string): Promise<{ message: KidsSocialGroupMessage | null; blocked: boolean }> {
  const userId = await requireUserId();
  const result = moderateKidsText(rawText);
  if (result.blocked) return { message: null, blocked: true };

  const { data, error } = await kidsDb
    .from("kids_social_group_messages")
    .insert({ group_id: groupId, user_id: userId, content: result.cleanText, was_filtered: result.wasFiltered })
    .select("*").single()
    .returns<KidsSocialGroupMessage>();
  if (error) throw error;

  supabase.functions.invoke("moderate-content", { body: { text: result.cleanText } }).then(({ data: modData }) => {
    if (modData?.flagged) {
      kidsDb.from("kids_social_group_messages").update({ is_flagged: true, flagged_categories: modData.categories ?? [] }).eq("id", data.id);
    }
  }).catch(() => {});

  return { message: data, blocked: false };
}

export async function fetchGroupMaterials(groupId: string): Promise<KidsSocialGroupMaterial[]> {
  const { data, error } = await kidsDb.from("kids_social_group_materials").select("*").eq("group_id", groupId).order("created_at", { ascending: false }).returns<KidsSocialGroupMaterial[]>();
  if (error) throw error;
  return data ?? [];
}

export async function uploadGroupMaterial(groupId: string, file: File, title: string): Promise<KidsSocialGroupMaterial> {
  const userId = await requireUserId();
  const path = `${userId}/${groupId}/${Date.now()}-${file.name}`;
  const { error: uploadErr } = await kidsDb.storage.from("kids-social-media").upload(path, file);
  if (uploadErr) throw uploadErr;
  const { data: pub } = kidsDb.storage.from("kids-social-media").getPublicUrl(path);

  const { data, error } = await kidsDb
    .from("kids_social_group_materials")
    .insert({ group_id: groupId, uploaded_by: userId, title, file_url: pub.publicUrl })
    .select("*").single()
    .returns<KidsSocialGroupMaterial>();
  if (error) throw error;
  return data;
}

export async function fetchGroupAssignments(groupId: string): Promise<KidsSocialGroupAssignment[]> {
  const { data, error } = await kidsDb.from("kids_social_group_assignments").select("*").eq("group_id", groupId).order("due_at").returns<KidsSocialGroupAssignment[]>();
  if (error) throw error;
  return data ?? [];
}

export async function createGroupAssignment(groupId: string, title: string, description?: string, dueAt?: string): Promise<KidsSocialGroupAssignment> {
  const userId = await requireUserId();
  const { data, error } = await kidsDb
    .from("kids_social_group_assignments")
    .insert({ group_id: groupId, created_by: userId, title, description: description ?? null, due_at: dueAt ?? null })
    .select("*").single()
    .returns<KidsSocialGroupAssignment>();
  if (error) throw error;
  return data;
}

export async function fetchMyAssignmentSubmission(assignmentId: string): Promise<KidsSocialGroupAssignmentSubmission | null> {
  const userId = await requireUserId();
  const { data, error } = await kidsDb
    .from("kids_social_group_assignment_submissions").select("*").eq("assignment_id", assignmentId).eq("user_id", userId).maybeSingle()
    .returns<KidsSocialGroupAssignmentSubmission>();
  if (error) throw error;
  return data ?? null;
}

export async function submitAssignment(assignmentId: string, content: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await kidsDb
    .from("kids_social_group_assignment_submissions")
    .upsert({ assignment_id: assignmentId, user_id: userId, content, submitted_at: new Date().toISOString() }, { onConflict: "assignment_id,user_id" });
  if (error) throw error;

  await kidsDb.rpc("award_kids_xp", { _amount: 20, _reason: `Group assignment submitted: ${assignmentId}` }).then(() => {}, () => {});
  await kidsDb.rpc("award_kids_coins", { _amount: 10, _reason: `Group assignment submitted: ${assignmentId}` }).then(() => {}, () => {});
}
