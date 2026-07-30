export type KidsColor = "primary" | "secondary" | "accent" | "pink" | "green" | "purple";

export type HabitKind = "habit" | "routine";
export type RoutineSlot = "anytime" | "morning" | "school" | "evening" | "weekend";

export interface WellnessHabit {
  slug: string;
  title: string;
  description: string | null;
  emoji: string;
  kind: HabitKind;
  routine_slot: RoutineSlot;
  color: KidsColor;
  reward_xp: number;
  reward_coins: number;
  order_index: number;
  status: "published" | "draft";
  created_at: string;
}

export type WellnessCategory = "nutrition" | "exercise" | "mindfulness" | "safety" | "first_aid";

export interface WellnessLesson {
  id: string;
  category: WellnessCategory;
  topic: string;
  slug: string;
  title: string;
  emoji: string;
  summary: string | null;
  body: string | null;
  steps: string[];
  content: Record<string, unknown>;
  duration_seconds: number | null;
  color: KidsColor;
  order_index: number;
  status: "published" | "draft";
  created_at: string;
}

export type ChallengePeriod = "daily" | "weekly";
export type ChallengeMetric = "water" | "walk" | "read" | "sleep" | "exercise";

export interface HealthyChallenge {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  emoji: string;
  period: ChallengePeriod;
  metric: ChallengeMetric;
  target_value: number;
  unit: string | null;
  reward_xp: number;
  reward_coins: number;
  order_index: number;
  status: "published" | "draft";
  created_at: string;
}

export interface EmergencyNumbers {
  country_code: string;
  country_name: string;
  general: string | null;
  police: string | null;
  ambulance: string | null;
  fire: string | null;
  note: string | null;
  order_index: number;
}

export interface HabitLog {
  user_id: string;
  habit_slug: string;
  log_date: string;
}

export type Mood = "great" | "good" | "okay" | "sad" | "angry" | "worried" | "tired";

export interface MoodLog {
  user_id: string;
  log_date: string;
  mood: Mood;
  color: string | null;
  note: string | null;
}

export type SleepQuality = "great" | "ok" | "poor";

export interface SleepLog {
  user_id: string;
  log_date: string;
  bedtime: string | null;
  wake_time: string | null;
  duration_minutes: number | null;
  quality: SleepQuality | null;
}

export interface WellnessSession {
  id: string;
  user_id: string;
  kind: "exercise" | "mindfulness";
  ref_slug: string;
  minutes: number;
  logged_at: string;
}

export interface ChallengeProgress {
  user_id: string;
  challenge_id: string;
  period_start: string;
  progress: number;
  completed: boolean;
}

export interface Companion {
  user_id: string;
  name: string;
  avatar: string;
  hobbies: string[];
  goals: string[];
  created_at: string;
  updated_at: string;
}

export interface WellnessSettings {
  user_id: string;
  country_code: string;
  custom_emergency: Record<string, unknown>;
  reminders_enabled: boolean;
  updated_at: string;
}

export type WellnessRank = "sprout" | "budding" | "growing" | "strong" | "champion";

export interface WellnessStats {
  streak: number;
  habits_today: number;
  mood_today: boolean;
  sleep_today: boolean;
  sessions: number;
  challenges_completed: number;
  wellness_rank: WellnessRank;
}
