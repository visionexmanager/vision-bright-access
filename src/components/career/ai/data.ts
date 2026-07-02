import { FileText, FileSearch, Mail, Mic, Target, LineChart, Compass, Route, Plane, Activity } from "lucide-react";
import type { AIModuleDef } from "./types";

export const AI_MODULES: AIModuleDef[] = [
  { id: "resumeBuilder", icon: FileText, titleKey: "aiSuite.module.resumeBuilder.title", descKey: "aiSuite.module.resumeBuilder.desc", accent: "linear-gradient(135deg,#6366f1,#8b5cf6)" },
  { id: "resumeAnalyzer", icon: FileSearch, titleKey: "aiSuite.module.resumeAnalyzer.title", descKey: "aiSuite.module.resumeAnalyzer.desc", accent: "linear-gradient(135deg,#0ea5e9,#22d3ee)" },
  { id: "coverLetter", icon: Mail, titleKey: "aiSuite.module.coverLetter.title", descKey: "aiSuite.module.coverLetter.desc", accent: "linear-gradient(135deg,#ec4899,#f472b6)" },
  { id: "interviewSimulator", icon: Mic, titleKey: "aiSuite.module.interviewSimulator.title", descKey: "aiSuite.module.interviewSimulator.desc", accent: "linear-gradient(135deg,#f59e0b,#fb923c)" },
  { id: "jobMatching", icon: Target, titleKey: "aiSuite.module.jobMatching.title", descKey: "aiSuite.module.jobMatching.desc", accent: "linear-gradient(135deg,#10b981,#34d399)" },
  { id: "salaryPredictor", icon: LineChart, titleKey: "aiSuite.module.salaryPredictor.title", descKey: "aiSuite.module.salaryPredictor.desc", accent: "linear-gradient(135deg,#14b8a6,#2dd4bf)" },
  { id: "careerCoach", icon: Compass, titleKey: "aiSuite.module.careerCoach.title", descKey: "aiSuite.module.careerCoach.desc", accent: "linear-gradient(135deg,#a855f7,#c084fc)" },
  { id: "careerRoadmap", icon: Route, titleKey: "aiSuite.module.careerRoadmap.title", descKey: "aiSuite.module.careerRoadmap.desc", accent: "linear-gradient(135deg,#6366f1,#22d3ee)" },
  { id: "visaAssistant", icon: Plane, titleKey: "aiSuite.module.visaAssistant.title", descKey: "aiSuite.module.visaAssistant.desc", accent: "linear-gradient(135deg,#f97316,#f59e0b)" },
  { id: "healthScore", icon: Activity, titleKey: "aiSuite.module.healthScore.title", descKey: "aiSuite.module.healthScore.desc", accent: "linear-gradient(135deg,#ef4444,#f87171)" },
];
