import type { EmployerMessageThread } from "../types";

export const MOCK_EMPLOYER_MESSAGES: EmployerMessageThread[] = [
  {
    id: "em-1", candidateName: "Layla Haddad", candidateColor: "#6366f1", jobTitle: "Senior Frontend Engineer (React)",
    subject: "Availability for technical interview", preview: "Thanks for reaching out! I'm available...",
    body: "Thanks for reaching out! I'm available Monday through Thursday next week, mornings work best for me. Looking forward to it.",
    date: "2026-07-01", read: false,
  },
  {
    id: "em-2", candidateName: "Nadia Ferreira", candidateColor: "#ec4899", jobTitle: "AI Prompt Engineer",
    subject: "Re: Technical interview results", preview: "Thank you for the detailed feedback...",
    body: "Thank you for the detailed feedback after the interview. I'm very excited about the opportunity and look forward to next steps.",
    date: "2026-06-30", read: false,
  },
  {
    id: "em-3", candidateName: "Elena Petrova", candidateColor: "#0ea5e9", jobTitle: "Product Designer",
    subject: "Re: Offer letter", preview: "I've reviewed the offer and have a couple of questions...",
    body: "I've reviewed the offer and have a couple of questions about the remote work policy and start date flexibility. Could we hop on a call?",
    date: "2026-07-01", read: true,
  },
  {
    id: "em-4", candidateName: "Omar Khalil", candidateColor: "#10b981", jobTitle: "Senior Frontend Engineer (React)",
    subject: "Application follow-up", preview: "Just checking in on the status of my application...",
    body: "Just checking in on the status of my application. Happy to provide any additional information you might need.",
    date: "2026-06-27", read: true,
  },
];
