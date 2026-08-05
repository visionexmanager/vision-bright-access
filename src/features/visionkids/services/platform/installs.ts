import { kidsDb, rpcResult } from "@/features/visionkids/services/stories/kidsSupabase";
import type { PluginInstall, DashboardWidget, KidsNotification, PlatformStats } from "@/features/visionkids/types/platform.types";

async function currentUserId(): Promise<string | null> {
  const { data } = await kidsDb.auth.getUser();
  return data.user?.id ?? null;
}

// ── Plugin installs ──────────────────────────────────────────────────────────
export async function fetchInstalls(): Promise<PluginInstall[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await kidsDb
    .from("kids_plugin_installs").select("*").eq("user_id", userId)
    .returns<PluginInstall[]>();
  if (error) throw error;
  return data ?? [];
}

export async function installPlugin(slug: string): Promise<void> {
  const { error } = await kidsDb.rpc("install_kids_plugin", { _slug: slug });
  if (error) throw error;
}

export async function uninstallPlugin(slug: string): Promise<void> {
  const { error } = await kidsDb.rpc("uninstall_kids_plugin", { _slug: slug });
  if (error) throw error;
}

export async function togglePlugin(slug: string, enabled: boolean): Promise<void> {
  const { error } = await kidsDb.rpc("toggle_kids_plugin", { _slug: slug, _enabled: enabled });
  if (error) throw error;
}

// ── Dashboard widgets ────────────────────────────────────────────────────────
export async function fetchDashboard(): Promise<DashboardWidget[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await kidsDb
    .from("kids_dashboard_widgets").select("*").eq("user_id", userId).order("position")
    .returns<DashboardWidget[]>();
  if (error) throw error;
  return data ?? [];
}

export async function setDashboard(widgetSlugs: string[]): Promise<void> {
  const { error } = await kidsDb.rpc("set_kids_dashboard", { _widgets: widgetSlugs });
  if (error) throw error;
}

// ── Theme preference ─────────────────────────────────────────────────────────
export async function fetchThemePref(): Promise<string | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  const { data, error } = await kidsDb
    .from("kids_theme_prefs").select("theme_slug").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return (data as { theme_slug: string } | null)?.theme_slug ?? null;
}

export async function setThemePref(slug: string): Promise<void> {
  const { error } = await kidsDb.rpc("set_kids_theme", { _slug: slug });
  if (error) throw error;
}

// ── Notifications ────────────────────────────────────────────────────────────
export async function fetchNotifications(): Promise<KidsNotification[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await kidsDb
    .from("kids_notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50)
    .returns<KidsNotification[]>();
  if (error) throw error;
  return data ?? [];
}

export async function markNotificationRead(id: string | null): Promise<void> {
  const { error } = await kidsDb.rpc("mark_kids_notification_read", { _id: id });
  if (error) throw error;
}

// ── Stats ────────────────────────────────────────────────────────────────────
export async function fetchPlatformStats(): Promise<PlatformStats> {
  const { data, error } = await kidsDb.rpc("get_kids_platform_stats");
  if (error) throw error;
  return rpcResult<PlatformStats>(data);
}
