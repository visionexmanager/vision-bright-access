import type { NetworkPerson, SuggestedPerson } from "../types";

export const MOCK_FOLLOWERS: NetworkPerson[] = [
  { id: "p-1", name: "David Cohen", headline: "Engineering Manager at Nova Systems", avatarColor: "#10b981", isFollowing: true },
  { id: "p-2", name: "Priya Nair", headline: "Product Designer", avatarColor: "#f59e0b", isFollowing: false },
  { id: "p-3", name: "Omar Khalil", headline: "Frontend Developer", avatarColor: "#10b981", isFollowing: true },
  { id: "p-4", name: "Layla Haddad", headline: "Senior Frontend Engineer", avatarColor: "#6366f1", isFollowing: false },
];

export const MOCK_FOLLOWING: NetworkPerson[] = [
  { id: "p-5", name: "Nadia Ferreira", headline: "AI / Prompt Engineer", avatarColor: "#ec4899", isFollowing: true },
  { id: "p-6", name: "Ravi Shankar", headline: "ML / AI Engineer", avatarColor: "#f97316", isFollowing: true },
  { id: "p-7", name: "Elena Petrova", headline: "Product Designer", avatarColor: "#0ea5e9", isFollowing: true },
];

export const MOCK_SUGGESTED: SuggestedPerson[] = [
  { id: "sg-1", name: "Marcus Johnson", headline: "Customer Support Lead", avatarColor: "#8b5cf6", isFollowing: false, reason: "Works at a company you've saved jobs from." },
  { id: "sg-2", name: "Fatima Zahra", headline: "Frontend Engineer", avatarColor: "#14b8a6", isFollowing: false, reason: "Shares your interest in Accessibility and React." },
  { id: "sg-3", name: "Yusuf Demir", headline: "Backend Developer", avatarColor: "#f59e0b", isFollowing: false, reason: "Active in the same communities as you." },
  { id: "sg-4", name: "Sara Al-Amin", headline: "HR Admin at Nova Systems", avatarColor: "#6366f1", isFollowing: false, reason: "You both work with people at Nova Systems." },
];
