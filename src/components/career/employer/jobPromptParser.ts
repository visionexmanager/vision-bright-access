import type { JobPosting } from "./types";

// Local keyword-based mock generator — no external API call.
// Return shape mirrors JobPosting so a real LLM call can replace generateJobFromPrompt() later.

const ROLE_KEYWORDS = ["react", "frontend", "backend", "node", "python", "designer", "product manager", "data scientist", "devops", "marketing", "sales", "support"];

const SALARY_BANDS: Record<string, [number, number]> = {
  low: [40000, 60000],
  medium: [70000, 100000],
  high: [110000, 160000],
};

function detectRole(text: string): string {
  const lower = text.toLowerCase();
  const found = ROLE_KEYWORDS.find((kw) => lower.includes(kw));
  if (!found) return "New Role";
  return found
    .split(" ")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

function detectWorkMode(text: string): JobPosting["workMode"] {
  const lower = text.toLowerCase();
  if (lower.includes("remote") || lower.includes("عن بعد") || lower.includes("عن بُعد")) return "remote";
  if (lower.includes("hybrid") || lower.includes("هجين")) return "hybrid";
  return "onsite";
}

function detectSalaryBand(text: string): keyof typeof SALARY_BANDS {
  const lower = text.toLowerCase();
  if (lower.includes("high") || lower.includes("عالي") || lower.includes("مرتفع")) return "high";
  if (lower.includes("low") || lower.includes("منخفض")) return "low";
  return "medium";
}

function detectVisa(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes("visa") || lower.includes("تأشيرة") || lower.includes("sponsorship");
}

const SKILLS_BY_ROLE: Record<string, string[]> = {
  React: ["React", "TypeScript", "CSS", "REST APIs"],
  Frontend: ["JavaScript", "HTML/CSS", "React", "Accessibility"],
  Backend: ["Node.js", "SQL", "REST APIs", "System Design"],
  Node: ["Node.js", "Express", "PostgreSQL"],
  Python: ["Python", "Django/Flask", "SQL"],
  Designer: ["Figma", "Design Systems", "User Research"],
  "Product Manager": ["Roadmapping", "Stakeholder Management", "Analytics"],
  "Data Scientist": ["Python", "Statistics", "Machine Learning"],
  Devops: ["Docker", "Kubernetes", "CI/CD"],
  Marketing: ["SEO", "Content Strategy", "Analytics"],
  Sales: ["CRM", "Negotiation", "Pipeline Management"],
  Support: ["Zendesk", "Communication", "Troubleshooting"],
};

export function generateJobFromPrompt(prompt: string): Partial<JobPosting> {
  const role = detectRole(prompt);
  const workMode = detectWorkMode(prompt);
  const band = detectSalaryBand(prompt);
  const [salaryMin, salaryMax] = SALARY_BANDS[band];
  const skills = SKILLS_BY_ROLE[role] ?? ["Communication", "Problem Solving"];
  const visaSponsorship = detectVisa(prompt);

  const title = `${role} Developer`.includes("Developer Developer") ? role : `${role}${/developer|engineer/i.test(role) ? "" : " Developer"}`;

  return {
    title: role === "New Role" ? "New Role" : title,
    description: `We're looking for a ${role} to join our team${workMode === "remote" ? ", working fully remote" : ""}. You'll work closely with our product and engineering teams to ship high-quality, accessible experiences.`,
    requirements: [
      `Proven experience relevant to ${role}`,
      "Strong communication and collaboration skills",
      "A portfolio or track record of shipped work",
    ],
    skills,
    salaryMin,
    salaryMax,
    currency: "USD",
    type: "Full-time",
    location: workMode === "remote" ? "Remote" : "On-site",
    workMode,
    visaSponsorship,
    accessibilityTags: ["Screen reader tested", "Flexible hours"],
    optimizationScore: 65 + skills.length * 5,
  };
}
