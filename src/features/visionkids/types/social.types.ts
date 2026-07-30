// ── Family / parent controls ──────────────────────────────────────────────
export interface KidsFamily {
  id: string;
  parent_user_id: string;
  family_name: string;
  created_at: string;
}

export interface KidsParentChildLink {
  id: string;
  parent_user_id: string;
  child_user_id: string;
  family_id: string | null;
  linked_at: string;
}

export interface KidsChildSettings {
  child_user_id: string;
  daily_limit_minutes: number;
  bedtime_start: string | null;
  bedtime_end: string | null;
  study_time_start: string | null;
  study_time_end: string | null;
  break_interval_minutes: number;
  allow_games: boolean;
  allow_videos: boolean;
  allow_chat: boolean;
  allow_voice_rooms: boolean;
  allow_ai: boolean;
  allow_downloads: boolean;
  allow_sharing: boolean;
  recording_consent: boolean;
  updated_at: string;
}

export type UsageCategory = "learning" | "play" | "creative" | "social" | "explore" | "other";

export interface KidsUsageStatus {
  minutes_used_today: number;
  daily_limit_minutes: number;
  is_over_limit: boolean;
}

// ── Friends ────────────────────────────────────────────────────────────────
export type FriendshipStatus = "pending" | "accepted" | "declined" | "blocked";

export interface KidsFriendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  blocked_by: string | null;
  created_at: string;
  responded_at: string | null;
}

export interface KidsFriendProfile {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

// ── Safe chat ──────────────────────────────────────────────────────────────
export interface KidsConversation {
  id: string;
  user_a: string;
  user_b: string;
  last_message_text: string | null;
  last_message_at: string;
  created_at: string;
}

export interface KidsMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  was_filtered: boolean;
  is_flagged: boolean;
  flagged_categories: string[];
  is_read: boolean;
  created_at: string;
}

// ── Clubs (study / reading / creative) ─────────────────────────────────────
export type SocialGroupType =
  | "study" | "reading" | "creative_drawing" | "creative_stories"
  | "creative_music" | "creative_coding" | "creative_robotics";

export interface KidsSocialGroup {
  id: string;
  group_type: SocialGroupType;
  slug: string;
  name: string;
  description: string | null;
  emoji: string;
  owner_id: string | null;
  is_public: boolean;
  max_members: number;
  story_of_week_id: string | null;
  status: "active" | "archived";
  created_at: string;
}

export type GroupMemberRole = "owner" | "moderator" | "member";

export interface KidsSocialGroupMember {
  group_id: string;
  user_id: string;
  role: GroupMemberRole;
  joined_at: string;
}

export interface KidsSocialGroupMessage {
  id: string;
  group_id: string;
  user_id: string;
  content: string;
  was_filtered: boolean;
  is_flagged: boolean;
  flagged_categories: string[];
  created_at: string;
}

export interface KidsSocialGroupMaterial {
  id: string;
  group_id: string;
  uploaded_by: string | null;
  title: string;
  file_url: string;
  created_at: string;
}

export interface KidsSocialGroupAssignment {
  id: string;
  group_id: string;
  created_by: string | null;
  title: string;
  description: string | null;
  due_at: string | null;
  created_at: string;
}

export interface KidsSocialGroupAssignmentSubmission {
  id: string;
  assignment_id: string;
  user_id: string;
  content: string | null;
  file_url: string | null;
  submitted_at: string;
}

// ── Voice rooms ─────────────────────────────────────────────────────────────
export interface KidsVoiceRoom {
  id: string;
  owner_id: string | null;
  group_id: string | null;
  room_name: string;
  topic: string | null;
  max_users: number;
  is_private: boolean;
  allow_chat: boolean;
  status: "scheduled" | "live" | "ended";
  scheduled_at: string | null;
  recording_active: boolean;
  created_at: string;
  ended_at: string | null;
}

export type VoiceRoomMemberRole = "owner" | "moderator" | "participant";

export interface KidsVoiceRoomMember {
  room_id: string;
  user_id: string;
  role: VoiceRoomMemberRole;
  is_muted: boolean;
  is_listener: boolean;
  raised_at: string | null;
  joined_at: string;
}

// ── Challenges hub ──────────────────────────────────────────────────────────
export interface KidsSocialChallenge {
  id: string;
  title: string;
  description: string | null;
  challenge_type: "individual" | "team";
  group_id: string | null;
  starts_at: string;
  ends_at: string;
  reward_xp: number;
  reward_coins: number;
  status: "active" | "ended";
  created_at: string;
}

export interface KidsSocialChallengeParticipant {
  challenge_id: string;
  user_id: string;
  score: number;
  joined_at: string;
  completed_at: string | null;
}

// ── Reports / moderation ────────────────────────────────────────────────────
export type ReportContentType = "kids_message" | "kids_group_message" | "kids_user" | "kids_voice_room" | "kids_social_group";

export interface ContentReport {
  id: string;
  reporter_id: string | null;
  content_type: string;
  content_id: string;
  reason: string;
  details: string | null;
  status: "pending" | "reviewed" | "dismissed" | "actioned";
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export type ModerationAction = "warning" | "mute" | "ban";
export type ModerationScope = "global" | "group" | "room";

export interface KidsSocialUserModeration {
  id: string;
  user_id: string;
  action: ModerationAction;
  reason: string | null;
  scope_type: ModerationScope;
  scope_id: string | null;
  moderator_id: string | null;
  expires_at: string | null;
  created_at: string;
}

// ── Notifications (shared site-wide table) ──────────────────────────────────
export type KidsNotificationType = "info" | "warning" | "success" | "error" | "achievement" | "message" | "invite" | "challenge" | "weekly_report";

export interface KidsNotification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: KidsNotificationType;
  is_read: boolean;
  sent_by: string | null;
  created_at: string;
}
