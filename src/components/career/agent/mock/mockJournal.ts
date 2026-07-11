import type { JournalEntry } from "../types";

export const MOCK_JOURNAL: JournalEntry[] = [
  { id: "j-1", kind: "application", title: "Applied to Senior Frontend Engineer at Nova Systems", date: "2026-06-20" },
  { id: "j-2", kind: "interview", title: "Completed HR interview with Nova Systems", date: "2026-06-24" },
  { id: "j-3", kind: "skill", title: "Added TypeScript to your skill profile", date: "2026-06-14" },
  { id: "j-4", kind: "certificate", title: "Earned Web Accessibility Specialist (WAS) certificate", date: "2026-03-01" },
  { id: "j-5", kind: "achievement", title: "Unlocked \"Interview Ready\" badge", date: "2026-06-24" },
  { id: "j-6", kind: "milestone", title: "Reached Career Level 7", date: "2026-06-01" },
  { id: "j-7", kind: "application", title: "Applied to AI Prompt Engineer at Vertex AI Labs", date: "2026-06-25" },
];

export const WEEKLY_REVIEW = {
  applicationsSent: 2,
  interviewsCompleted: 1,
  skillsLearned: 1,
  summary: "A strong week — you applied to 2 roles, completed 1 interview, and picked up a new certification. Keep the momentum going into next week.",
};
