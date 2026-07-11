import {
  BrainCircuit, Code2, HeartPulse, Wrench, Palette, ShieldCheck, Megaphone,
  Calculator, Briefcase, Globe, Eye, Accessibility, Rocket, Laptop,
} from "lucide-react";
import type { Community, CommunityCategory } from "../types";
import type { FeedPostData } from "@/components/career/network/types";

function post(id: string, author: string, color: string, headline: string, content: string, likes: number): FeedPostData {
  return {
    id, authorName: author, authorHeadline: headline, authorColor: color,
    type: "careerPost", content, hashtags: [], mentions: [],
    reactions: { like: likes, celebrate: 0, insightful: Math.round(likes / 4), support: 0 },
    userReaction: null, comments: [], bookmarked: false, shares: Math.round(likes / 10), date: "2026-06-28",
  };
}

interface CommunitySeed {
  id: string;
  name: string;
  icon: typeof BrainCircuit;
  category: CommunityCategory;
  color: string;
  description: string;
  memberCount: number;
}

const SEEDS: CommunitySeed[] = [
  { id: "ai", name: "AI", icon: BrainCircuit, category: "technology", color: "#a855f7", description: "Discussing applied AI, LLMs, and the future of intelligent products.", memberCount: 48210 },
  { id: "programming", name: "Programming", icon: Code2, category: "technology", color: "#6366f1", description: "Code reviews, architecture debates, and career advice for developers.", memberCount: 61340 },
  { id: "healthcare", name: "Healthcare", icon: HeartPulse, category: "industry", color: "#10b981", description: "For clinicians, health-tech builders, and healthcare administrators.", memberCount: 22190 },
  { id: "engineering", name: "Engineering", icon: Wrench, category: "industry", color: "#f97316", description: "Mechanical, civil, and industrial engineers sharing real-world problems.", memberCount: 18760 },
  { id: "design", name: "Design", icon: Palette, category: "technology", color: "#ec4899", description: "Product, UX, and visual designers critiquing and celebrating great work.", memberCount: 29840 },
  { id: "cybersecurity", name: "Cybersecurity", icon: ShieldCheck, category: "technology", color: "#ef4444", description: "Threat intel, career paths, and best practices in security.", memberCount: 15230 },
  { id: "marketing", name: "Marketing", icon: Megaphone, category: "business", color: "#f59e0b", description: "Growth, brand, and content marketers swapping playbooks.", memberCount: 20110 },
  { id: "accounting", name: "Accounting", icon: Calculator, category: "business", color: "#0ea5e9", description: "CPAs and finance professionals discussing standards and careers.", memberCount: 9840 },
  { id: "business", name: "Business", icon: Briefcase, category: "business", color: "#6366f1", description: "General business strategy, leadership, and management discussion.", memberCount: 33920 },
  { id: "remote-workers", name: "Remote Workers", icon: Globe, category: "workStyle", color: "#14b8a6", description: "Tips, tools, and support for fully remote careers.", memberCount: 41250 },
  { id: "blind-professionals", name: "Blind Professionals", icon: Eye, category: "accessibility", color: "#8b5cf6", description: "A community for blind and low-vision professionals to connect and support each other.", memberCount: 4820 },
  { id: "accessibility", name: "Accessibility", icon: Accessibility, category: "accessibility", color: "#22c55e", description: "Accessibility engineers, advocates, and inclusive-design practitioners.", memberCount: 12630 },
  { id: "startup-founders", name: "Startup Founders", icon: Rocket, category: "business", color: "#f43f5e", description: "Founders trading notes on fundraising, hiring, and building from zero.", memberCount: 17400 },
  { id: "freelancers", name: "Freelancers", icon: Laptop, category: "workStyle", color: "#0ea5e9", description: "Independent professionals sharing client tips and rate benchmarks.", memberCount: 26580 },
];

export const MOCK_COMMUNITIES: Community[] = SEEDS.map((seed, i) => ({
  id: seed.id,
  name: seed.name,
  icon: seed.icon,
  category: seed.category,
  color: seed.color,
  description: seed.description,
  memberCount: seed.memberCount,
  isJoined: i < 3,
  rules: [
    "Be respectful — no harassment, hate speech, or personal attacks.",
    "Keep posts relevant to the community topic.",
    "No spam, self-promotion, or unsolicited recruiting DMs.",
  ],
  moderators: [
    { id: `${seed.id}-mod-1`, name: "Sara Al-Amin", avatarColor: "#6366f1", role: "admin" },
    { id: `${seed.id}-mod-2`, name: "David Cohen", avatarColor: "#10b981", role: "moderator" },
  ],
  resources: [
    { id: `${seed.id}-res-1`, title: `Getting Started in ${seed.name}`, type: "guide" },
    { id: `${seed.id}-res-2`, title: `${seed.name} Career Roadmap`, type: "article" },
  ],
  events: [
    { id: `${seed.id}-evt-1`, title: `${seed.name} Monthly Meetup`, date: "2026-07-15" },
  ],
  members: [
    { id: `${seed.id}-mem-1`, name: "Layla Haddad", headline: "Senior Frontend Engineer", avatarColor: "#6366f1" },
    { id: `${seed.id}-mem-2`, name: "Omar Khalil", headline: "Frontend Developer", avatarColor: "#10b981" },
    { id: `${seed.id}-mem-3`, name: "Nadia Ferreira", headline: "AI / Prompt Engineer", avatarColor: "#ec4899" },
  ],
  posts: [
    post(`${seed.id}-post-1`, "Ravi Shankar", "#f97316", "ML / AI Engineer", `Excited to be part of the ${seed.name} community — looking forward to learning from everyone here!`, 34),
    post(`${seed.id}-post-2`, "Elena Petrova", "#0ea5e9", "Product Designer", `What's one resource that helped you the most when you were starting out in ${seed.name}?`, 21),
  ],
}));
