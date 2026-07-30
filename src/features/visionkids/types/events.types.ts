export type EventType = "live" | "workshop" | "competition" | "seasonal";
export type EventStatus = "draft" | "scheduled" | "live" | "ended" | "cancelled";
export type EventAgeGroup = "3-5" | "6-8" | "9-12" | "all";
export type EventLevel = "beginner" | "intermediate" | "advanced" | "all";

export interface KidsEvent {
  id: string;
  event_type: EventType;
  category: string;
  slug: string;
  title: string;
  description: string | null;
  emoji: string;
  cover_image_url: string | null;
  age_group: EventAgeGroup;
  language: string;
  level: EventLevel;
  host_id: string | null;
  voice_room_id: string | null;
  starts_at: string;
  ends_at: string;
  status: EventStatus;
  capacity: number | null;
  reward_xp: number;
  reward_coins: number;
  reaction_counts: Record<string, number>;
  created_at: string;
}

export type RegistrationStatus = "registered" | "waitlisted" | "cancelled";
export type ParentalApprovalStatus = "not_required" | "pending" | "approved" | "denied";

export interface KidsEventRegistration {
  id: string;
  event_id: string;
  user_id: string;
  status: RegistrationStatus;
  parental_approval_status: ParentalApprovalStatus;
  registered_at: string;
  decided_at: string | null;
}

export interface KidsEventAttendance {
  id: string;
  event_id: string;
  user_id: string;
  joined_at: string;
  left_at: string | null;
  duration_seconds: number;
}

export interface KidsEventMessage {
  id: string;
  event_id: string;
  user_id: string;
  content: string;
  was_filtered: boolean;
  is_flagged: boolean;
  flagged_categories: string[];
  created_at: string;
}

export interface KidsEventPoll {
  id: string;
  event_id: string;
  question: string;
  options: string[];
  created_by: string | null;
  is_active: boolean;
  closes_at: string | null;
  created_at: string;
}

export interface KidsEventPollVote {
  id: string;
  poll_id: string;
  user_id: string;
  option_index: number;
  created_at: string;
}

export interface KidsEventQuestion {
  id: string;
  event_id: string;
  user_id: string;
  question: string;
  upvote_count: number;
  is_answered: boolean;
  answer_text: string | null;
  answered_at: string | null;
  created_at: string;
}

export interface KidsEventReplay {
  id: string;
  event_id: string;
  video_url: string | null;
  thumbnail_url: string | null;
  captions_url: string | null;
  duration_seconds: number;
  view_count: number;
  created_at: string;
}

export interface KidsReplayProgress {
  user_id: string;
  replay_id: string;
  position_seconds: number;
  updated_at: string;
}

export type MedalType = "gold" | "silver" | "bronze" | "participation";

export interface KidsEventMedal {
  id: string;
  event_id: string;
  user_id: string;
  medal_type: MedalType;
  awarded_by: string | null;
  awarded_at: string;
}

export interface KidsEventSubmission {
  id: string;
  event_id: string;
  user_id: string;
  content: string | null;
  file_url: string | null;
  score: number | null;
  rank: number | null;
  submitted_at: string;
}

export interface KidsEventLimitedReward {
  id: string;
  title: string;
  description: string | null;
  emoji: string;
  event_id: string | null;
  seasonal_key: string | null;
  quantity_total: number;
  quantity_claimed: number;
  expires_at: string | null;
  created_at: string;
}

export interface KidsUniverseCity {
  slug: string;
  name: string;
  theme: string;
  emoji: string;
  color: "primary" | "secondary" | "accent" | "pink" | "green" | "purple";
  description: string | null;
  order_index: number;
  created_at: string;
}

export interface KidsUniverseCharacter {
  id: string;
  city_slug: string;
  name: string;
  emoji: string;
  bio: string | null;
  created_at: string;
}

export interface KidsUniverseCityVisit {
  user_id: string;
  city_slug: string;
  first_visited_at: string;
}

export interface KidsEventCertificate {
  id: string;
  certificate_number: string;
  verification_code: string;
  title: string;
  recipient_name: string;
  issuer_name: string;
  issued_at: string;
}
