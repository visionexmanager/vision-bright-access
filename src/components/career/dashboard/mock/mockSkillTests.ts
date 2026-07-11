import type { SkillTestEntry } from "../types";

export const MOCK_SKILL_TESTS: SkillTestEntry[] = [
  { id: "test-1", name: "React Fundamentals", status: "completed", score: 92, durationMinutes: 30 },
  { id: "test-2", name: "TypeScript Proficiency", status: "completed", score: 87, durationMinutes: 25 },
  { id: "test-3", name: "Web Accessibility (WCAG 2.2)", status: "in_progress", score: null, durationMinutes: 40 },
  { id: "test-4", name: "System Design Basics", status: "not_started", score: null, durationMinutes: 45 },
  { id: "test-5", name: "Node.js & APIs", status: "not_started", score: null, durationMinutes: 35 },
];
