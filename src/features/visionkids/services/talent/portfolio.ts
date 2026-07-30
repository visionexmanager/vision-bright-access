import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type { PortfolioItem, PortfolioKind, PortfolioSource } from "@/features/visionkids/types/talent.types";

export async function fetchMyPortfolio(): Promise<PortfolioItem[]> {
  const { data: authData } = await kidsDb.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) return [];
  const { data, error } = await kidsDb
    .from("kids_portfolio_items").select("*").eq("user_id", userId).order("created_at", { ascending: false })
    .returns<PortfolioItem[]>();
  if (error) throw error;
  return data ?? [];
}

export interface NewPortfolioItem {
  kind: PortfolioKind;
  title: string;
  description?: string;
  emoji?: string;
  content?: Record<string, unknown>;
  source?: PortfolioSource;
  track_slug?: string | null;
}

export async function addPortfolioItem(item: NewPortfolioItem): Promise<PortfolioItem> {
  const { data: authData } = await kidsDb.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) throw new Error("Must be signed in");
  const { data, error } = await kidsDb
    .from("kids_portfolio_items")
    .insert({
      user_id: userId,
      kind: item.kind,
      title: item.title,
      description: item.description ?? null,
      emoji: item.emoji ?? "⭐",
      content: item.content ?? {},
      source: item.source ?? "manual",
      track_slug: item.track_slug ?? null,
    })
    .select("*").single()
    .returns<PortfolioItem>();
  if (error) throw error;
  return data;
}

export async function removePortfolioItem(id: string): Promise<void> {
  const { error } = await kidsDb.from("kids_portfolio_items").delete().eq("id", id);
  if (error) throw error;
}
