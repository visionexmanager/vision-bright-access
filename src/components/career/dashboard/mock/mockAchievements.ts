import { UserCheck, FileCheck, Send, MessageSquare, Trophy, Flame, Award, GraduationCap } from "lucide-react";
import type { AchievementBadge } from "../types";

export const MOCK_ACHIEVEMENTS: AchievementBadge[] = [
  { id: "ach-1", icon: UserCheck, titleKey: "careerDash.achievements.profilePro.title", descKey: "careerDash.achievements.profilePro.desc", unlocked: true, xp: 100 },
  { id: "ach-2", icon: FileCheck, titleKey: "careerDash.achievements.resumeReady.title", descKey: "careerDash.achievements.resumeReady.desc", unlocked: true, xp: 50 },
  { id: "ach-3", icon: Send, titleKey: "careerDash.achievements.firstApplication.title", descKey: "careerDash.achievements.firstApplication.desc", unlocked: true, xp: 75 },
  { id: "ach-4", icon: MessageSquare, titleKey: "careerDash.achievements.interviewReady.title", descKey: "careerDash.achievements.interviewReady.desc", unlocked: true, xp: 150 },
  { id: "ach-5", icon: Trophy, titleKey: "careerDash.achievements.offerReceived.title", descKey: "careerDash.achievements.offerReceived.desc", unlocked: true, xp: 300 },
  { id: "ach-6", icon: Flame, titleKey: "careerDash.achievements.consistentApplicant.title", descKey: "careerDash.achievements.consistentApplicant.desc", unlocked: false, xp: 120 },
  { id: "ach-7", icon: Award, titleKey: "careerDash.achievements.skillMaster.title", descKey: "careerDash.achievements.skillMaster.desc", unlocked: false, xp: 200 },
  { id: "ach-8", icon: GraduationCap, titleKey: "careerDash.achievements.certified.title", descKey: "careerDash.achievements.certified.desc", unlocked: true, xp: 100 },
];

export const MOCK_CAREER_LEVEL = { level: 7, xp: 995, xpForNextLevel: 1200 };
