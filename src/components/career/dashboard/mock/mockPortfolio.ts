import type { PortfolioItem } from "../types";

export const MOCK_PORTFOLIO: PortfolioItem[] = [
  { id: "pf-1", title: "Accessible Component Library", description: "Open-source React components built AAA-accessible from the ground up.", tags: ["React", "Accessibility"], color: "#6366f1" },
  { id: "pf-2", title: "Screen Reader Testing Toolkit", description: "CLI tool that automates NVDA/VoiceOver regression checks in CI.", tags: ["Node.js", "Testing"], color: "#10b981" },
  { id: "pf-3", title: "Patient Portal Redesign", description: "Led an accessibility-first redesign of a healthcare patient portal.", tags: ["UX", "Healthcare"], color: "#ec4899" },
];
