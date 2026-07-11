import { TrendingUp, Sparkles, Coins, Atom, BrainCircuit, Globe } from "lucide-react";
import type { CareerInsight } from "./types";

export const CAREER_INSIGHTS: CareerInsight[] = [
  {
    id: "fastestGrowing", icon: TrendingUp,
    titleKey: "careersPage.insight.fastestGrowing.title", descKey: "careersPage.insight.fastestGrowing.desc",
    items: ["AI Engineer", "Renewable Energy Technician", "Nurse Practitioner", "Data Analyst", "UX Researcher"],
  },
  {
    id: "inDemandSkills", icon: Sparkles,
    titleKey: "careersPage.insight.inDemandSkills.title", descKey: "careersPage.insight.inDemandSkills.desc",
    items: ["Python", "Prompt Engineering", "Cloud Architecture", "Data Analysis", "Accessibility Design"],
  },
  {
    id: "highestPaying", icon: Coins,
    titleKey: "careersPage.insight.highestPaying.title", descKey: "careersPage.insight.highestPaying.desc",
    items: ["AI Research Scientist", "Cloud Solutions Architect", "Investment Banker", "Petroleum Engineer", "Product Director"],
  },
  {
    id: "emergingTech", icon: Atom,
    titleKey: "careersPage.insight.emergingTech.title", descKey: "careersPage.insight.emergingTech.desc",
    items: ["Generative AI", "Quantum Computing", "Edge Computing", "AR/VR", "Bioinformatics"],
  },
  {
    id: "aiCareers", icon: BrainCircuit,
    titleKey: "careersPage.insight.aiCareers.title", descKey: "careersPage.insight.aiCareers.desc",
    items: ["ML Engineer", "AI Product Manager", "Prompt Engineer", "AI Ethicist", "MLOps Engineer"],
  },
  {
    id: "remoteTrends", icon: Globe,
    titleKey: "careersPage.insight.remoteTrends.title", descKey: "careersPage.insight.remoteTrends.desc",
    items: ["Async-first teams", "4-day remote weeks", "Global hiring", "Remote stipends", "Hybrid-by-default"],
  },
];
