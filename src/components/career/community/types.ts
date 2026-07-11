import type { LucideIcon } from "lucide-react";
import type { FeedPostData } from "@/components/career/network/types";

export type CommunityCategory = "technology" | "industry" | "business" | "accessibility" | "workStyle";

export interface CommunityModerator {
  id: string;
  name: string;
  avatarColor: string;
  role: "moderator" | "admin";
}

export interface CommunityResource {
  id: string;
  title: string;
  type: "article" | "guide" | "template" | "link";
}

export interface CommunityEvent {
  id: string;
  title: string;
  date: string;
}

export interface CommunityMember {
  id: string;
  name: string;
  headline: string;
  avatarColor: string;
}

export interface Community {
  id: string;
  name: string;
  icon: LucideIcon;
  category: CommunityCategory;
  color: string;
  description: string;
  memberCount: number;
  isJoined: boolean;
  rules: string[];
  moderators: CommunityModerator[];
  resources: CommunityResource[];
  events: CommunityEvent[];
  members: CommunityMember[];
  posts: FeedPostData[];
}
