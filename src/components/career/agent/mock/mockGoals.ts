import type { CareerGoalItem } from "../types";

export const GOAL_LIBRARY_KEYS = [
  "agentUI.goalLib.remoteJob",
  "agentUI.goalLib.raisePay",
  "agentUI.goalLib.visaSponsorship",
  "agentUI.goalLib.teamLead",
  "agentUI.goalLib.moveToAi",
  "agentUI.goalLib.learnCybersecurity",
  "agentUI.goalLib.freelance",
];

export const MOCK_GOALS: CareerGoalItem[] = [
  { id: "goal-1", titleKey: "agentUI.goalLib.remoteJob", priority: "high", deadline: "2026-09-30", progress: 65, estimatedCompletion: "2026-09-10" },
  { id: "goal-2", titleKey: "agentUI.goalLib.raisePay", priority: "medium", deadline: "2026-12-31", progress: 40, estimatedCompletion: "2026-11-15" },
  { id: "goal-3", titleKey: "agentUI.goalLib.moveToAi", priority: "high", deadline: "2027-03-01", progress: 28, estimatedCompletion: "2027-02-10" },
  { id: "goal-4", titleKey: "agentUI.goalLib.teamLead", priority: "low", deadline: "2027-06-30", progress: 12, estimatedCompletion: "2027-05-20" },
];
