import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import { getDeviceKey, detectPlatform, suggestDeviceName, APP_VERSION } from "@/features/visionkids/everywhere/platform";
import type { Device, DeviceSession, Download, DownloadKind, UserPreferences } from "@/features/visionkids/types/everywhere.types";

async function currentUserId(): Promise<string | null> {
  const { data } = await kidsDb.auth.getUser();
  return data.user?.id ?? null;
}

// ── Devices ──────────────────────────────────────────────────────────────────
export async function registerCurrentDevice(): Promise<void> {
  const platform = detectPlatform();
  await kidsDb.rpc("register_kids_device", {
    _device_key: getDeviceKey(), _name: suggestDeviceName(platform), _platform: platform, _app_version: APP_VERSION,
  });
}

export async function touchCurrentDevice(): Promise<void> {
  await kidsDb.rpc("touch_kids_device", { _device_key: getDeviceKey() });
}

export async function fetchDevices(): Promise<Device[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await kidsDb
    .from("kids_devices").select("*").eq("user_id", userId).order("last_active", { ascending: false })
    .returns<Device[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchSessions(): Promise<DeviceSession[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await kidsDb
    .from("kids_device_sessions").select("*").eq("user_id", userId).order("login_at", { ascending: false }).limit(50)
    .returns<DeviceSession[]>();
  if (error) throw error;
  return data ?? [];
}

export async function signOutDevice(deviceId: string): Promise<void> {
  const { error } = await kidsDb.rpc("sign_out_kids_device", { _device_id: deviceId });
  if (error) throw error;
}

export async function signOutAllDevices(): Promise<void> {
  const { error } = await kidsDb.rpc("sign_out_all_kids_devices", { _keep_device_key: getDeviceKey() });
  if (error) throw error;
}

// ── Downloads ────────────────────────────────────────────────────────────────
// kids_offline_downloads, not kids_downloads — the latter belongs to Stories
// and holds per-story download logs with an entirely different shape.
export async function fetchDownloads(): Promise<Download[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await kidsDb
    .from("kids_offline_downloads").select("*").eq("user_id", userId).order("downloaded_at", { ascending: false })
    .returns<Download[]>();
  if (error) throw error;
  return data ?? [];
}

export async function addDownload(input: { kind: DownloadKind; refId: string; title: string; sizeKb: number }): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw new Error("Must be signed in");
  const { error } = await kidsDb.from("kids_offline_downloads").upsert({
    user_id: userId, content_kind: input.kind, ref_id: input.refId, title: input.title, size_kb: input.sizeKb, device_key: getDeviceKey(),
  }, { onConflict: "user_id,content_kind,ref_id" });
  if (error) throw error;
}

export async function removeDownload(kind: DownloadKind, refId: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  const { error } = await kidsDb.from("kids_offline_downloads").delete().eq("user_id", userId).eq("content_kind", kind).eq("ref_id", refId);
  if (error) throw error;
}

// ── Preferences ──────────────────────────────────────────────────────────────
export async function fetchPreferences(): Promise<UserPreferences | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  const { data, error } = await kidsDb.from("kids_user_preferences").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return (data as UserPreferences | null) ?? null;
}

export async function savePreferences(p: Pick<UserPreferences, "low_data" | "wifi_only" | "auto_download" | "tv_mode" | "audio_guidance">): Promise<void> {
  const { error } = await kidsDb.rpc("save_kids_preferences", {
    _low_data: p.low_data, _wifi_only: p.wifi_only, _auto_download: p.auto_download, _tv_mode: p.tv_mode, _audio_guidance: p.audio_guidance,
  });
  if (error) throw error;
}
