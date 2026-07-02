import type { AgentNotification } from "../types";

export const MOCK_NOTIFICATIONS: AgentNotification[] = [
  { id: "an-1", category: "jobs", title: "3 new jobs match your profile", description: "Senior Frontend Engineer roles just opened at 3 companies you're interested in.", date: "2026-07-02", read: false },
  { id: "an-2", category: "interviews", title: "Interview reminder", description: "Your interview with Nova Systems is tomorrow at 3:00 PM.", date: "2026-07-02", read: false },
  { id: "an-3", category: "salary", title: "Salary trend update", description: "Frontend Engineer salaries in your target market rose 4% this quarter.", date: "2026-07-01", read: false },
  { id: "an-4", category: "learning", title: "New course recommendation", description: "\"Advanced Accessibility Patterns\" matches your career interests.", date: "2026-06-30", read: true },
  { id: "an-5", category: "companies", title: "Company hiring surge", description: "Vertex AI Labs just posted 8 new roles.", date: "2026-06-29", read: true },
  { id: "an-6", category: "visa", title: "New visa-friendly listings", description: "5 new visa-sponsorship jobs match your preferred countries.", date: "2026-06-28", read: true },
  { id: "an-7", category: "accessibility", title: "Accessibility badge added", description: "Nova Systems added a screen-reader-friendly badge to their careers page.", date: "2026-06-26", read: true },
];
