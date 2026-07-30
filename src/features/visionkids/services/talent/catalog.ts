import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type {
  TalentDomain, TalentTrack, TrackModule, FutureSkill, Career, Mentor,
} from "@/features/visionkids/types/talent.types";

export async function fetchDomains(): Promise<TalentDomain[]> {
  const { data, error } = await kidsDb
    .from("kids_talent_domains").select("*").eq("status", "published").order("order_index")
    .returns<TalentDomain[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchTracks(): Promise<TalentTrack[]> {
  const { data, error } = await kidsDb
    .from("kids_talent_tracks").select("*").eq("status", "published").order("order_index")
    .returns<TalentTrack[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchTrack(slug: string): Promise<TalentTrack | null> {
  const { data, error } = await kidsDb
    .from("kids_talent_tracks").select("*").eq("slug", slug).maybeSingle()
    .returns<TalentTrack>();
  if (error) throw error;
  return data ?? null;
}

export async function fetchTrackModules(trackSlug: string): Promise<TrackModule[]> {
  const { data, error } = await kidsDb
    .from("kids_track_modules").select("*").eq("track_slug", trackSlug).eq("status", "published").order("order_index")
    .returns<TrackModule[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchModule(trackSlug: string, moduleSlug: string): Promise<TrackModule | null> {
  const { data, error } = await kidsDb
    .from("kids_track_modules").select("*").eq("track_slug", trackSlug).eq("slug", moduleSlug).maybeSingle()
    .returns<TrackModule>();
  if (error) throw error;
  return data ?? null;
}

export async function fetchFutureSkills(): Promise<FutureSkill[]> {
  const { data, error } = await kidsDb
    .from("kids_future_skills").select("*").eq("status", "published").order("order_index")
    .returns<FutureSkill[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchFutureSkill(slug: string): Promise<FutureSkill | null> {
  const { data, error } = await kidsDb
    .from("kids_future_skills").select("*").eq("slug", slug).maybeSingle()
    .returns<FutureSkill>();
  if (error) throw error;
  return data ?? null;
}

export async function fetchCareers(): Promise<Career[]> {
  const { data, error } = await kidsDb
    .from("kids_careers").select("*").eq("status", "published").order("order_index")
    .returns<Career[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchCareer(slug: string): Promise<Career | null> {
  const { data, error } = await kidsDb
    .from("kids_careers").select("*").eq("slug", slug).maybeSingle()
    .returns<Career>();
  if (error) throw error;
  return data ?? null;
}

export async function fetchMentors(): Promise<Mentor[]> {
  const { data, error } = await kidsDb
    .from("kids_mentors").select("*").eq("status", "published").order("order_index")
    .returns<Mentor[]>();
  if (error) throw error;
  return data ?? [];
}
