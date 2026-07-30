export type KidsColor = "primary" | "secondary" | "accent" | "pink" | "green" | "purple";

export interface TalentDomain {
  slug: string;
  title: string;
  description: string | null;
  emoji: string;
  color: KidsColor;
  order_index: number;
  status: "published" | "draft";
  created_at: string;
}

export interface AssessmentOption {
  id: string;
  label: string;
  emoji: string;
  weights: Record<string, number>;
}

export interface AssessmentQuestion {
  id: string;
  prompt: string;
  emoji: string;
  options: AssessmentOption[];
  order_index: number;
}

export interface TalentResult {
  user_id: string;
  domain_scores: Record<string, number>;
  top_domains: string[];
  taken_at: string;
}

export interface SkillTask {
  // Skills store tasks as an ordered array of short strings (the checklist).
  label: string;
}

export interface Skill {
  slug: string;
  domain_slug: string;
  title: string;
  description: string | null;
  emoji: string;
  tier: number;
  prerequisites: string[];
  tasks: string[];
  badge_key: string | null;
  reward_xp: number;
  reward_coins: number;
  order_index: number;
  status: "published" | "draft";
  created_at: string;
}

export interface SkillProgress {
  user_id: string;
  skill_slug: string;
  completed_tasks: number;
  status: "in_progress" | "completed";
  updated_at: string;
  completed_at: string | null;
}

export interface TalentTrack {
  slug: string;
  title: string;
  description: string | null;
  emoji: string;
  color: KidsColor;
  primary_domain: string | null;
  is_future_track: boolean;
  order_index: number;
  status: "published" | "draft";
  created_at: string;
}

export type ModuleKind = "lesson" | "activity" | "project";

export interface TrackModule {
  id: string;
  track_slug: string;
  slug: string;
  title: string;
  description: string | null;
  emoji: string;
  kind: ModuleKind;
  content: Record<string, unknown>;
  reward_xp: number;
  reward_coins: number;
  order_index: number;
  status: "published" | "draft";
  created_at: string;
}

export interface ModuleProgress {
  user_id: string;
  module_id: string;
  track_slug: string;
  completed_at: string;
}

export interface FutureSkill {
  slug: string;
  title: string;
  description: string | null;
  why_it_matters: string | null;
  emoji: string;
  color: KidsColor;
  related_track: string | null;
  order_index: number;
  status: "published" | "draft";
  created_at: string;
}

export interface Career {
  slug: string;
  title: string;
  description: string | null;
  emoji: string;
  color: KidsColor;
  skill_domains: string[];
  related_tracks: string[];
  a_day_like: string | null;
  order_index: number;
  status: "published" | "draft";
  created_at: string;
}

export interface Mentor {
  slug: string;
  name: string;
  title: string;
  bio: string | null;
  emoji: string;
  expertise: string[];
  related_tracks: string[];
  accepting: boolean;
  order_index: number;
  status: "published" | "draft";
  created_at: string;
}

export interface MentorRequest {
  id: string;
  user_id: string;
  mentor_slug: string;
  topic: string | null;
  status: "pending" | "accepted" | "declined" | "completed";
  created_at: string;
}

export type PortfolioKind = "project" | "drawing" | "story" | "game" | "certificate" | "award" | "other";
export type PortfolioSource = "manual" | "track" | "studio" | "assessment" | "system";

export interface PortfolioItem {
  id: string;
  user_id: string;
  kind: PortfolioKind;
  title: string;
  description: string | null;
  emoji: string;
  content: Record<string, unknown>;
  source: PortfolioSource;
  track_slug: string | null;
  created_at: string;
}

export type TalentRank = "novice" | "rising_star" | "talented" | "expert" | "prodigy";
export type InnovationRank = "curious" | "maker" | "builder" | "innovator" | "visionary";

export interface TalentStats {
  skills_completed: number;
  modules_completed: number;
  tracks_completed: number;
  portfolio_count: number;
  has_assessment: boolean;
  talent_rank: TalentRank;
  innovation_rank: InnovationRank;
}

export interface TalentCertificate {
  id: string;
  certificate_number: string;
  verification_code: string;
  title: string;
  recipient_name: string;
  issuer_name: string;
  issued_at: string;
}
