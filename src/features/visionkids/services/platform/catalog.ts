import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type { Plugin, WidgetDef, Theme, PluginVersion } from "@/features/visionkids/types/platform.types";

export async function fetchPlugins(category?: string): Promise<Plugin[]> {
  let query = kidsDb.from("kids_plugins").select("*").eq("status", "published").order("order_index");
  if (category && category !== "all") query = query.eq("category", category);
  const { data, error } = await query.returns<Plugin[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchPluginVersions(slug: string): Promise<PluginVersion[]> {
  const { data, error } = await kidsDb
    .from("kids_plugin_versions").select("*").eq("plugin_slug", slug).order("released_at", { ascending: false })
    .returns<PluginVersion[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchWidgets(): Promise<WidgetDef[]> {
  const { data, error } = await kidsDb
    .from("kids_widgets").select("*").eq("status", "published").order("order_index")
    .returns<WidgetDef[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchThemes(): Promise<Theme[]> {
  const { data, error } = await kidsDb
    .from("kids_themes").select("*").eq("status", "published").order("order_index")
    .returns<Theme[]>();
  if (error) throw error;
  return data ?? [];
}
