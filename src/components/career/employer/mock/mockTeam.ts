import type { TeamMember } from "../types";

export const MOCK_TEAM: TeamMember[] = [
  { id: "team-1", name: "Sara Al-Amin", email: "sara@novasystems.com", role: "admin", avatarColor: "#6366f1", joinedDate: "2024-01-15" },
  { id: "team-2", name: "Amina Yusuf", email: "amina@novasystems.com", role: "recruiter", avatarColor: "#ec4899", joinedDate: "2024-05-03" },
  { id: "team-3", name: "David Cohen", email: "david@novasystems.com", role: "hr", avatarColor: "#10b981", joinedDate: "2024-08-20" },
  { id: "team-4", name: "Priya Nair", email: "priya@novasystems.com", role: "viewer", avatarColor: "#f59e0b", joinedDate: "2025-02-11" },
];

export const ROLE_PERMISSIONS: Record<TeamMember["role"], { postJobs: boolean; viewCandidates: boolean; manageTeam: boolean; viewAnalytics: boolean }> = {
  admin: { postJobs: true, viewCandidates: true, manageTeam: true, viewAnalytics: true },
  hr: { postJobs: true, viewCandidates: true, manageTeam: false, viewAnalytics: true },
  recruiter: { postJobs: true, viewCandidates: true, manageTeam: false, viewAnalytics: false },
  viewer: { postJobs: false, viewCandidates: true, manageTeam: false, viewAnalytics: false },
};
