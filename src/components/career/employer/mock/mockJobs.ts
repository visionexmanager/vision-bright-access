import type { JobPosting } from "../types";

export const MOCK_EMPLOYER_JOBS: JobPosting[] = [
  {
    id: "ej-1", title: "Senior Frontend Engineer (React)",
    description: "Own the frontend architecture for our SaaS platform, with a strong focus on accessible, inclusive UI.",
    requirements: ["5+ years of frontend experience", "Deep React & TypeScript expertise", "Experience with WCAG-compliant UI"],
    skills: ["React", "TypeScript", "Accessibility", "GraphQL"],
    salaryMin: 110000, salaryMax: 145000, currency: "USD", type: "Full-time", location: "Remote", workMode: "remote",
    visaSponsorship: false, accessibilityTags: ["Screen reader tested", "Flexible hours"],
    status: "active", postedDate: "2026-06-20", applicantCount: 34, optimizationScore: 88,
  },
  {
    id: "ej-2", title: "AI Prompt Engineer",
    description: "Design and evaluate prompts and agent workflows for our LLM products.",
    requirements: ["2+ years working with LLMs", "Strong writing and evaluation skills"],
    skills: ["Prompt Design", "LLMs", "Evaluation"],
    salaryMin: 70000, salaryMax: 95000, currency: "USD", type: "Contract", location: "Remote", workMode: "remote",
    visaSponsorship: false, accessibilityTags: ["Screen reader tested"],
    status: "active", postedDate: "2026-06-28", applicantCount: 19, optimizationScore: 76,
  },
  {
    id: "ej-3", title: "Junior Backend Developer",
    description: "Build reliable backend services for our marketplace platform.",
    requirements: ["1-2 years of backend experience", "Familiarity with Node.js and SQL"],
    skills: ["Node.js", "PostgreSQL"],
    salaryMin: 65000, salaryMax: 80000, currency: "USD", type: "Full-time", location: "Austin, USA", workMode: "hybrid",
    visaSponsorship: false, accessibilityTags: [],
    status: "paused", postedDate: "2026-05-15", applicantCount: 41, optimizationScore: 62,
  },
  {
    id: "ej-4", title: "Product Designer",
    description: "Design accessible, delightful product experiences for our client portfolio.",
    requirements: ["3+ years of product design experience", "Portfolio demonstrating accessible design"],
    skills: ["Figma", "Design Systems", "Accessibility"],
    salaryMin: 60000, salaryMax: 85000, currency: "USD", type: "Freelance", location: "Remote", workMode: "remote",
    visaSponsorship: false, accessibilityTags: ["Accessible design focus"],
    status: "draft", postedDate: "2026-07-01", applicantCount: 0, optimizationScore: 54,
  },
  {
    id: "ej-5", title: "Customer Support Specialist",
    description: "Help customers succeed with our platform via chat and email support.",
    requirements: ["Excellent written communication", "Experience with helpdesk tooling"],
    skills: ["Zendesk", "Communication"],
    salaryMin: 38000, salaryMax: 48000, currency: "USD", type: "Full-time", location: "Remote", workMode: "remote",
    visaSponsorship: false, accessibilityTags: ["Screen reader tested", "Assistive tooling provided"],
    status: "closed", postedDate: "2026-04-10", applicantCount: 58, optimizationScore: 81,
  },
];
