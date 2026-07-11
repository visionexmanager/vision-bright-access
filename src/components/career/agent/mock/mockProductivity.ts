import type { ProductivityTask } from "../types";

export const TODAYS_TASKS: ProductivityTask[] = [
  { id: "t1", titleKey: "agentUI.productivity.task1", done: true },
  { id: "t2", titleKey: "agentUI.productivity.task2", done: false },
  { id: "t3", titleKey: "agentUI.productivity.task3", done: false },
  { id: "t4", titleKey: "agentUI.productivity.task4", done: false },
];

export const FOCUS_SUGGESTIONS = [
  "agentUI.productivity.focus1",
  "agentUI.productivity.focus2",
  "agentUI.productivity.focus3",
];

export const WEEKLY_GOAL_PROGRESS = 62;
export const MONTHLY_PROGRESS = 44;
export const CAREER_STREAK_DAYS = 12;
