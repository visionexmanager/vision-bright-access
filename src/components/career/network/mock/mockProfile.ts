import type { ProfessionalProfile, Recommendation } from "../types";

// Illustrative profile only — wire up to Supabase once accounts are connected.
export const MOCK_PROFESSIONAL_PROFILE: ProfessionalProfile = {
  fullName: "Amina Al-Rashid",
  headline: "Senior Frontend Engineer · Accessibility Advocate",
  about: "I build accessible, inclusive web products and love helping teams ship UI that works for everyone. 6+ years of experience across SaaS and healthcare.",
  avatarColor: "#6366f1",
  location: "Amman, Jordan",
  experience: [
    { id: "exp-1", title: "Senior Frontend Engineer", company: "Nova Systems", period: "2023 – Present" },
    { id: "exp-2", title: "Frontend Engineer", company: "BrightPath Health", period: "2020 – 2022" },
  ],
  skills: ["React", "TypeScript", "Accessibility (WCAG)", "Node.js", "GraphQL"],
  education: [{ id: "edu-1", degree: "B.Sc. Computer Science", institution: "University of Jordan", period: "2014 – 2018" }],
  projects: [
    { id: "proj-1", title: "Accessible Component Library", description: "Open-source React components built AAA-accessible from the ground up." },
    { id: "proj-2", title: "Screen Reader Testing Toolkit", description: "CLI tool automating NVDA/VoiceOver regression checks in CI." },
  ],
  portfolioUrl: "amina.dev",
  certificates: ["Web Accessibility Specialist (WAS)", "AWS Certified Cloud Practitioner"],
  languages: ["Arabic (Native)", "English (Fluent)", "French (Conversational)"],
  achievements: [
    { id: "ach-1", title: "Accessibility Champion Award — Nova Systems", date: "2025" },
    { id: "ach-2", title: "Speaker, Global A11y Conference", date: "2024" },
  ],
  followers: 1284,
  following: 356,
};

export const MOCK_RECOMMENDATIONS: Recommendation[] = [
  { id: "rec-1", authorName: "David Cohen", authorHeadline: "Engineering Manager at Nova Systems", authorColor: "#10b981", text: "Amina consistently raises the bar for accessible UI on our team. Her attention to detail and mentorship are exceptional.", date: "2026-05-10" },
  { id: "rec-2", authorName: "Priya Nair", authorHeadline: "Product Designer", authorColor: "#f59e0b", text: "One of the best frontend collaborators I've worked with — she catches accessibility issues before they ever reach QA.", date: "2026-02-18" },
];
