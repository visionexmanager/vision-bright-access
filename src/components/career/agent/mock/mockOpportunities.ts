import type { OpportunityEvent } from "../types";

// Illustrative "live monitor" feed — wire up to real job/market APIs later.
export const MOCK_OPPORTUNITIES: OpportunityEvent[] = [
  { id: "op-1", kind: "newJob", title: "Senior Frontend Engineer at Nova Systems", detail: "Matches 92% of your profile — remote, accessibility-focused team.", date: "2026-07-02" },
  { id: "op-2", kind: "salaryChange", title: "Frontend salaries up 4% this quarter", detail: "Your target role's median pay rose in your preferred markets.", date: "2026-07-01" },
  { id: "op-3", kind: "hiringCompany", title: "Vertex AI Labs is hiring aggressively", detail: "8 new roles posted this week, 3 match your skill set.", date: "2026-06-30" },
  { id: "op-4", kind: "visaOpportunity", title: "New visa-sponsorship listings in Canada", detail: "5 companies added visa sponsorship tags this week.", date: "2026-06-29" },
  { id: "op-5", kind: "remoteOpportunity", title: "Remote job postings up 6%", detail: "More fully-remote frontend roles opened in the last 30 days.", date: "2026-06-28" },
  { id: "op-6", kind: "emergingSkill", title: "\"AI Prompt Engineering\" demand rising fast", detail: "Growing 118% year-over-year — consider adding it to your profile.", date: "2026-06-27" },
];
