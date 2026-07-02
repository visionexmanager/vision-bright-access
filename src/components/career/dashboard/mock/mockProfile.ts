import type { UserProfile } from "../types";

// Illustrative profile only — wire up to the authenticated user record once accounts are connected.
export const MOCK_PROFILE: UserProfile = {
  fullName: "Amina Al-Rashid",
  headline: "Frontend Engineer · Accessibility Advocate",
  bio: "Frontend engineer with 6 years of experience building accessible, inclusive web products. Passionate about assistive technology and inclusive hiring.",
  avatarColor: "#6366f1",
  location: "Amman, Jordan",
  links: {
    github: "github.com/amina-dev",
    linkedin: "linkedin.com/in/amina-alrashid",
    portfolio: "amina.dev",
    website: "amina.dev/blog",
  },
  skills: [
    { id: "sk-1", name: "React", category: "Frontend", proficiency: "expert", yearsExperience: 6, lastUsed: "2026-07-01" },
    { id: "sk-2", name: "TypeScript", category: "Frontend", proficiency: "advanced", yearsExperience: 5, lastUsed: "2026-07-01" },
    { id: "sk-3", name: "Accessibility (WCAG)", category: "Specialty", proficiency: "expert", yearsExperience: 4, lastUsed: "2026-06-28" },
    { id: "sk-4", name: "Node.js", category: "Backend", proficiency: "intermediate", yearsExperience: 3, lastUsed: "2026-05-10" },
    { id: "sk-5", name: "Figma", category: "Design", proficiency: "intermediate", yearsExperience: 2, lastUsed: "2026-04-15" },
    { id: "sk-6", name: "GraphQL", category: "Backend", proficiency: "intermediate", yearsExperience: 2, lastUsed: "2026-03-01" },
  ],
  experience: [
    { id: "ex-1", title: "Senior Frontend Engineer", company: "Nova Systems", location: "Remote", startDate: "2023-01", endDate: null, description: "Lead accessible UI architecture for a SaaS platform used by 50k+ users." },
    { id: "ex-2", title: "Frontend Engineer", company: "BrightPath Health", location: "Amman, Jordan", startDate: "2020-03", endDate: "2022-12", description: "Built patient-facing portals with a strong accessibility focus." },
    { id: "ex-3", title: "Junior Developer", company: "Clearview Design Studio", location: "Amman, Jordan", startDate: "2018-06", endDate: "2020-02", description: "Implemented responsive UI for client design systems." },
  ],
  education: [
    { id: "ed-1", degree: "B.Sc. Computer Science", institution: "University of Jordan", location: "Amman, Jordan", startYear: 2014, endYear: 2018 },
  ],
  languages: [
    { id: "lang-1", name: "Arabic", proficiency: "native" },
    { id: "lang-2", name: "English", proficiency: "fluent" },
    { id: "lang-3", name: "French", proficiency: "conversational" },
  ],
  projects: [
    { id: "pr-1", title: "Accessible Component Library", description: "An open-source React component library built AAA-accessible from the ground up.", tags: ["React", "Accessibility", "Open Source"], url: "github.com/amina-dev/a11y-kit" },
    { id: "pr-2", title: "Screen Reader Testing Toolkit", description: "CLI tool to automate NVDA/VoiceOver regression checks in CI.", tags: ["Node.js", "Testing"] },
  ],
  awards: [
    { id: "aw-1", title: "Accessibility Champion Award", issuer: "Nova Systems", year: 2025 },
  ],
  volunteering: [
    { id: "vo-1", role: "Mentor", organization: "Code for Inclusion", period: "2022 – Present" },
  ],
};
