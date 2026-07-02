import type { EmployerInterview } from "../types";

export const MOCK_EMPLOYER_INTERVIEWS: EmployerInterview[] = [
  {
    id: "ei-1", candidateId: "cand-1", candidateName: "Layla Haddad", jobTitle: "Senior Frontend Engineer (React)",
    mode: "technical", format: "live", status: "scheduled", scheduledDate: "2026-07-05", scores: null,
  },
  {
    id: "ei-2", candidateId: "cand-3", candidateName: "Nadia Ferreira", jobTitle: "AI Prompt Engineer",
    mode: "technical", format: "async_video", status: "completed", scheduledDate: "2026-06-29",
    scores: { candidateScore: 91, communication: 88, confidence: 90, technicalAccuracy: 94 },
  },
  {
    id: "ei-3", candidateId: "cand-5", candidateName: "Elena Petrova", jobTitle: "Product Designer",
    mode: "behavioral", format: "live", status: "completed", scheduledDate: "2026-06-18",
    scores: { candidateScore: 94, communication: 95, confidence: 92, technicalAccuracy: 93 },
  },
  {
    id: "ei-4", candidateId: "cand-8", candidateName: "Ravi Shankar", jobTitle: "AI Prompt Engineer",
    mode: "hr", format: "async_voice", status: "scheduled", scheduledDate: "2026-07-08", scores: null,
  },
];
