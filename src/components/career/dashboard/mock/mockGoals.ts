import { Globe, TrendingUp, Plane, Users, BrainCircuit } from "lucide-react";
import type { CareerGoal } from "../types";

export const MOCK_CAREER_GOALS: CareerGoal[] = [
  { id: "goal-1", titleKey: "careerDash.goals.remoteJob", icon: Globe, progress: 70, active: true },
  { id: "goal-2", titleKey: "careerDash.goals.raisePay", icon: TrendingUp, progress: 40, active: true },
  { id: "goal-3", titleKey: "careerDash.goals.relocate", icon: Plane, progress: 15, active: false },
  { id: "goal-4", titleKey: "careerDash.goals.management", icon: Users, progress: 25, active: false },
  { id: "goal-5", titleKey: "careerDash.goals.learnAi", icon: BrainCircuit, progress: 55, active: true },
];
