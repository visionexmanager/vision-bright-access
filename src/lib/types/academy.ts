/**
 * Academy Module — TypeScript Types
 * All Academy-related data structures used across hooks, services, and components.
 */

// ── Student Profile ──────────────────────────────────────────────────────────

export type AcademyGender = "male" | "female";

export type AcademyLevel =
  | "ابتدائي"
  | "متوسط"
  | "ثانوي / بكالوريا"
  | "جامعي / دراسات";

export interface StudentProfile {
  name: string;
  gender: AcademyGender;
  country: string;
  level: AcademyLevel | string;
}

/** Shape stored in Supabase `academy_profiles` table */
export interface AcademyProfileRow {
  user_id: string;
  name: string;
  gender: AcademyGender;
  country: string;
  level: string;
  xp_total: number;
  streak_days: number;
  last_active: string;    // ISO timestamp
  created_at: string;
  updated_at: string;
}

export type AcademyProfileInsert = Omit<
  AcademyProfileRow,
  "xp_total" | "streak_days" | "last_active" | "created_at" | "updated_at"
>;

export type AcademyProfileUpdate = Partial<
  Omit<AcademyProfileRow, "user_id" | "created_at">
>;

// ── Chat ─────────────────────────────────────────────────────────────────────

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
}

/** Shape stored in Supabase `academy_chat_sessions` table */
export interface AcademyChatSessionRow {
  id: string;
  user_id: string;
  session_id: string;   // groups messages in one conversation
  role: ChatRole;
  content: string;
  created_at: string;
}

export type AcademyChatSessionInsert = Omit<
  AcademyChatSessionRow,
  "id" | "created_at"
>;

// ── XP Events ────────────────────────────────────────────────────────────────

export type AcademyXPReason =
  | "academy_message_sent"
  | "academy_aptitude_completed"
  | "academy_streak"
  | "academy_scan_used"
  | "academy_study_room"
  | "academy_daily_login";

export interface AcademyXPEventRow {
  id: string;
  user_id: string;
  amount: number;
  reason: AcademyXPReason;
  created_at: string;
}

// ── API Request / Response Types ──────────────────────────────────────────────

export interface AcademyChatRequest {
  messages: Array<{ role: ChatRole; content: string }>;
  studentProfile: StudentProfile;
}

/** academy-chat returns SSE — this is the parsed delta shape */
export interface AcademyChatDelta {
  choices: Array<{
    delta: { content?: string };
    finish_reason?: string | null;
  }>;
}

// ── XP Card ──────────────────────────────────────────────────────────────────

export interface AcademyXPProgress {
  current: number;
  target: number;
  level: string;
  percentFilled: number;
  tasksUntilNextUnlock: number;
}
