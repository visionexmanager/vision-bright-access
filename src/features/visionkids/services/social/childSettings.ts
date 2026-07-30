import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type { KidsChildSettings } from "@/features/visionkids/types/social.types";

export async function fetchChildSettings(childUserId: string): Promise<KidsChildSettings | null> {
  const { data, error } = await kidsDb
    .from("kids_child_settings").select("*").eq("child_user_id", childUserId).maybeSingle()
    .returns<KidsChildSettings>();
  if (error) throw error;
  return data ?? null;
}

export type UpdateChildSettingsInput = Partial<Omit<KidsChildSettings, "child_user_id" | "updated_at">>;

export async function updateChildSettings(childUserId: string, input: UpdateChildSettingsInput): Promise<void> {
  const { error } = await kidsDb
    .from("kids_child_settings")
    .upsert({ child_user_id: childUserId, ...input }, { onConflict: "child_user_id" });
  if (error) throw error;
}
