import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type {
  WellnessHabit, WellnessLesson, WellnessCategory, HealthyChallenge, EmergencyNumbers, HabitKind,
} from "@/features/visionkids/types/wellness.types";

export async function fetchHabits(kind?: HabitKind): Promise<WellnessHabit[]> {
  let query = kidsDb.from("kids_wellness_habits").select("*").eq("status", "published").order("order_index");
  if (kind) query = query.eq("kind", kind);
  const { data, error } = await query.returns<WellnessHabit[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchLessons(category: WellnessCategory, topic?: string): Promise<WellnessLesson[]> {
  let query = kidsDb.from("kids_wellness_lessons").select("*").eq("category", category).eq("status", "published").order("order_index");
  if (topic && topic !== "all") query = query.eq("topic", topic);
  const { data, error } = await query.returns<WellnessLesson[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchLesson(category: WellnessCategory, slug: string): Promise<WellnessLesson | null> {
  const { data, error } = await kidsDb
    .from("kids_wellness_lessons").select("*").eq("category", category).eq("slug", slug).maybeSingle().returns<WellnessLesson>();
  if (error) throw error;
  return data ?? null;
}

export async function fetchChallenges(): Promise<HealthyChallenge[]> {
  const { data, error } = await kidsDb
    .from("kids_healthy_challenges").select("*").eq("status", "published").order("order_index")
    .returns<HealthyChallenge[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchEmergencyNumbers(): Promise<EmergencyNumbers[]> {
  const { data, error } = await kidsDb
    .from("kids_emergency_numbers").select("*").eq("status", "published").order("order_index")
    .returns<EmergencyNumbers[]>();
  if (error) throw error;
  return data ?? [];
}
