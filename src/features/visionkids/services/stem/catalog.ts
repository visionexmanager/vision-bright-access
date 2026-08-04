import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type {
  StemLab, Experiment, InnovationChallenge, ResearchArticle,
} from "@/features/visionkids/types/stem.types";

export async function fetchLabs(): Promise<StemLab[]> {
  const { data, error } = await kidsDb
    .from("kids_stem_labs").select("*").eq("status", "published").order("order_index")
    .returns<StemLab[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchLab(slug: string): Promise<StemLab | null> {
  const { data, error } = await kidsDb
    .from("kids_stem_labs").select("*").eq("slug", slug).maybeSingle().returns<StemLab>();
  if (error) throw error;
  return data ?? null;
}

export async function fetchExperiments(lab: string, topic?: string): Promise<Experiment[]> {
  let query = kidsDb.from("kids_experiments").select("*").eq("lab", lab).eq("status", "published").order("order_index");
  if (topic && topic !== "all") query = query.eq("topic", topic);
  const { data, error } = await query.returns<Experiment[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchExperiment(lab: string, slug: string): Promise<Experiment | null> {
  const { data, error } = await kidsDb
    .from("kids_experiments").select("*").eq("lab", lab).eq("slug", slug).maybeSingle().returns<Experiment>();
  if (error) throw error;
  return data ?? null;
}

export async function fetchInnovationChallenges(): Promise<InnovationChallenge[]> {
  const { data, error } = await kidsDb
    .from("kids_innovation_challenges").select("*").eq("status", "published").order("order_index")
    .returns<InnovationChallenge[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchInnovationChallenge(slug: string): Promise<InnovationChallenge | null> {
  const { data, error } = await kidsDb
    .from("kids_innovation_challenges").select("*").eq("slug", slug).maybeSingle().returns<InnovationChallenge>();
  if (error) throw error;
  return data ?? null;
}

export async function fetchResearchArticles(category?: string): Promise<ResearchArticle[]> {
  let query = kidsDb.from("kids_research_articles").select("*").eq("status", "published").order("order_index");
  if (category && category !== "all") query = query.eq("category", category);
  const { data, error } = await query.returns<ResearchArticle[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchResearchArticle(slug: string): Promise<ResearchArticle | null> {
  const { data, error } = await kidsDb
    .from("kids_research_articles").select("*").eq("slug", slug).maybeSingle().returns<ResearchArticle>();
  if (error) throw error;
  return data ?? null;
}
