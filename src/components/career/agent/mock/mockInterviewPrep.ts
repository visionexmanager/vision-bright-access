import type { InterviewPrepQuestion } from "../types";

export const INTERVIEW_CHECKLIST = [
  "Research the company's mission and recent news",
  "Review the job description and match it to your experience",
  "Prepare 2-3 questions to ask the interviewer",
  "Test your camera and microphone (for video interviews)",
  "Have a copy of your resume and portfolio ready",
];

export const INTERVIEW_QUESTIONS: InterviewPrepQuestion[] = [
  { id: "q1", category: "common", question: "Tell me about yourself." },
  { id: "q2", category: "common", question: "Why do you want to work here?" },
  { id: "q3", category: "common", question: "What are your salary expectations?" },
  { id: "q4", category: "technical", question: "Walk me through how you'd debug a slow web page." },
  { id: "q5", category: "technical", question: "How do you approach accessibility in your work?" },
  { id: "q6", category: "technical", question: "Explain a technical decision you're proud of." },
  { id: "q7", category: "behavioral", question: "Describe a time you handled conflict with a teammate." },
  { id: "q8", category: "behavioral", question: "Tell me about a project that failed. What did you learn?" },
  { id: "q9", category: "behavioral", question: "How do you prioritize when everything feels urgent?" },
];

export const DRESS_TIPS = ["Business casual is safe for most tech interviews.", "Check the company culture on their site or social media for cues.", "Keep it simple and comfortable — confidence matters more than formality."];
export const MEETING_TIPS = ["Join 5 minutes early to handle any tech issues.", "Keep good posture and maintain eye contact with the camera.", "Have a quiet, well-lit space for video interviews."];
export const CONFIDENCE_TIPS = ["Practice your answers out loud, not just in your head.", "Remember: they already like your resume — this is a conversation, not a test.", "It's okay to pause and think before answering."];
