import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type { ExplorerWorld, ExplorerLocation } from "@/features/visionkids/types/explorer.types";

export async function fetchExplorerWorlds(): Promise<ExplorerWorld[]> {
  const { data, error } = await kidsDb
    .from("kids_explorer_worlds").select("*").order("order_index")
    .returns<ExplorerWorld[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchExplorerWorld(slug: string): Promise<ExplorerWorld | null> {
  const { data, error } = await kidsDb
    .from("kids_explorer_worlds").select("*").eq("slug", slug).maybeSingle()
    .returns<ExplorerWorld>();
  if (error) throw error;
  return data ?? null;
}

export async function fetchLocationsByWorld(worldSlug: string, category?: string): Promise<ExplorerLocation[]> {
  let query = kidsDb.from("kids_explorer_locations").select("*").eq("world_slug", worldSlug).order("order_index");
  if (category && category !== "all") query = query.eq("category", category);
  const { data, error } = await query.returns<ExplorerLocation[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchLocationBySlug(worldSlug: string, locationSlug: string): Promise<ExplorerLocation | null> {
  const { data, error } = await kidsDb
    .from("kids_explorer_locations").select("*").eq("world_slug", worldSlug).eq("slug", locationSlug).maybeSingle()
    .returns<ExplorerLocation>();
  if (error) throw error;
  return data ?? null;
}
