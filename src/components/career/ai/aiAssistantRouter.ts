import type { AIModuleId } from "./types";

export interface AssistantReply {
  reply: string;
  suggestedModule?: AIModuleId;
}

interface Rule {
  keywords: string[];
  module: AIModuleId;
  reply: string;
}

// Local keyword-based intent router — no external API call.
// Swap for a real LLM-backed assistant later without changing the calling UI.
const RULES: Rule[] = [
  {
    keywords: ["remote", "عن بعد", "عن بُعد", "كندا", "canada", "وظيفة في", "job in"],
    module: "jobMatching",
    reply: "I can help you find matching roles. Opening AI Job Matching so I can compare your profile against open positions.",
  },
  {
    keywords: ["كيف أطور", "develop my career", "career growth", "تطوير", "أطور مسيرتي"],
    module: "careerCoach",
    reply: "Great question — let's build a plan. Opening your AI Career Coach for daily tasks and learning suggestions.",
  },
  {
    keywords: ["راتب", "salary", "كم أتوقع", "expected pay", "كم راتبي"],
    module: "salaryPredictor",
    reply: "I can estimate a salary range based on your role, location, and experience. Opening AI Salary Predictor.",
  },
  {
    keywords: ["قيم سيرتي", "review my resume", "resume", "سيرتي الذاتية", "cv"],
    module: "resumeAnalyzer",
    reply: "Let's check your resume against ATS systems and find improvement areas. Opening AI Resume Analyzer.",
  },
  {
    keywords: ["حضرني", "حضّرني", "مقابلة", "interview", "prepare me"],
    module: "interviewSimulator",
    reply: "Let's practice. Opening the AI Interview Simulator so you can rehearse real questions.",
  },
  {
    keywords: ["ما الوظائف المناسبة", "which jobs", "suited for me", "تناسبني"],
    module: "jobMatching",
    reply: "Let's see what fits your profile best. Opening AI Job Matching.",
  },
  {
    keywords: ["هجرة", "تأشيرة", "visa", "relocate", "immigration"],
    module: "visaAssistant",
    reply: "I can check visa-sponsorship opportunities and relocation feasibility. Opening AI Visa & Relocation Assistant.",
  },
  {
    keywords: ["خارطة", "roadmap", "خطة", "data scientist", "أريد أن أصبح"],
    module: "careerRoadmap",
    reply: "Let's map the path to your target role step by step. Opening AI Career Roadmap Generator.",
  },
];

const FALLBACK_REPLY =
  "I can help with resumes, cover letters, interviews, job matching, salary estimates, career roadmaps, and visa/relocation questions. Try one of the examples below, or open a module from the grid.";

export function routeAssistantQuery(text: string): AssistantReply {
  const lower = text.toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
      return { reply: rule.reply, suggestedModule: rule.module };
    }
  }
  return { reply: FALLBACK_REPLY };
}
