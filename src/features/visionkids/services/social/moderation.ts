import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type { ContentReport, KidsSocialUserModeration, ModerationAction, ModerationScope } from "@/features/visionkids/types/social.types";

async function requireUserId(): Promise<string> {
  const { data } = await kidsDb.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error("Must be signed in");
  return id;
}

export async function fetchReportQueue(status: ContentReport["status"] = "pending"): Promise<ContentReport[]> {
  const { data, error } = await kidsDb
    .from("content_reports").select("*").eq("status", status).order("created_at", { ascending: false })
    .returns<ContentReport[]>();
  if (error) throw error;
  return data ?? [];
}

export async function resolveReport(reportId: string, status: ContentReport["status"]): Promise<void> {
  const moderatorId = await requireUserId();
  const { error } = await kidsDb
    .from("content_reports")
    .update({ status, reviewed_by: moderatorId, reviewed_at: new Date().toISOString() })
    .eq("id", reportId);
  if (error) throw error;

  await kidsDb.rpc("log_admin_action", { _action: `content_report_${status}`, _target_type: "content_report", _target_id: reportId }).then(() => {}, () => {});
}

export async function applyModerationAction(
  userId: string, action: ModerationAction, reason: string,
  scopeType: ModerationScope = "global", scopeId?: string, expiresAt?: string,
): Promise<void> {
  const moderatorId = await requireUserId();
  const { error } = await kidsDb
    .from("kids_social_user_moderation")
    .insert({ user_id: userId, action, reason, scope_type: scopeType, scope_id: scopeId ?? null, moderator_id: moderatorId, expires_at: expiresAt ?? null });
  if (error) throw error;

  await kidsDb.rpc("log_admin_action", { _action: `kids_social_${action}`, _target_type: "user", _target_id: userId, _details: { reason, scopeType, scopeId } }).then(() => {}, () => {});
}

export async function fetchModerationHistory(userId: string): Promise<KidsSocialUserModeration[]> {
  const { data, error } = await kidsDb
    .from("kids_social_user_moderation").select("*").eq("user_id", userId).order("created_at", { ascending: false })
    .returns<KidsSocialUserModeration[]>();
  if (error) throw error;
  return data ?? [];
}

export interface AdminLogEntry {
  id: string;
  admin_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export async function fetchAdminActionLog(limit = 50): Promise<AdminLogEntry[]> {
  const { data, error } = await kidsDb
    .from("admin_logs").select("*").order("created_at", { ascending: false }).limit(limit)
    .returns<AdminLogEntry[]>();
  if (error) throw error;
  return data ?? [];
}

export async function deleteGroupMessage(messageId: string): Promise<void> {
  const { error } = await kidsDb.from("kids_social_group_messages").delete().eq("id", messageId);
  if (error) throw error;
}

export async function endRoomAsModerator(roomId: string): Promise<void> {
  const { error } = await kidsDb.from("kids_voice_rooms").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", roomId);
  if (error) throw error;
  await kidsDb.rpc("log_admin_action", { _action: "kids_voice_room_ended", _target_type: "voice_room", _target_id: roomId }).then(() => {}, () => {});
}
