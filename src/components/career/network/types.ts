export type NetworkSection = "feed" | "profile" | "connections";

export type PostType = "careerPost" | "companyUpdate" | "hiringPost" | "poll" | "article" | "image" | "video" | "document";

export type ReactionType = "like" | "celebrate" | "insightful" | "support";

export interface PollOption {
  id: string;
  label: string;
  votes: number;
}

export interface PostComment {
  id: string;
  authorName: string;
  authorColor: string;
  text: string;
  date: string;
}

export interface FeedPostData {
  id: string;
  authorName: string;
  authorHeadline: string;
  authorColor: string;
  type: PostType;
  content: string;
  mediaLabel?: string;
  pollOptions?: PollOption[];
  hashtags: string[];
  mentions: string[];
  reactions: Record<ReactionType, number>;
  userReaction: ReactionType | null;
  comments: PostComment[];
  bookmarked: boolean;
  shares: number;
  date: string;
}

export interface TrendingTopic {
  tag: string;
  postCount: number;
}

// ── Professional profile ─────────────────────────────────────────────────
export interface ProfileExperienceEntry {
  id: string;
  title: string;
  company: string;
  period: string;
}

export interface ProfileEducationEntry {
  id: string;
  degree: string;
  institution: string;
  period: string;
}

export interface ProfileProjectEntry {
  id: string;
  title: string;
  description: string;
}

export interface ProfileAchievement {
  id: string;
  title: string;
  date: string;
}

export interface Recommendation {
  id: string;
  authorName: string;
  authorHeadline: string;
  authorColor: string;
  text: string;
  date: string;
}

export interface ProfessionalProfile {
  fullName: string;
  headline: string;
  about: string;
  avatarColor: string;
  location: string;
  experience: ProfileExperienceEntry[];
  skills: string[];
  education: ProfileEducationEntry[];
  projects: ProfileProjectEntry[];
  portfolioUrl: string;
  certificates: string[];
  languages: string[];
  achievements: ProfileAchievement[];
  followers: number;
  following: number;
}

// ── Connections ───────────────────────────────────────────────────────────
export interface NetworkPerson {
  id: string;
  name: string;
  headline: string;
  avatarColor: string;
  isFollowing: boolean;
}

export interface SuggestedPerson extends NetworkPerson {
  reason: string;
}
