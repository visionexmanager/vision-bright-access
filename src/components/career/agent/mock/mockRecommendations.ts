import type { RecommendationItem } from "../types";

export const MOCK_RECOMMENDATIONS: RecommendationItem[] = [
  { id: "rec-1", kind: "job", title: "Senior Frontend Engineer", subtitle: "Nova Systems · Remote", reason: "Matches your React and accessibility skills, and your remote preference.", matchScore: 92 },
  { id: "rec-2", kind: "job", title: "AI Prompt Engineer", subtitle: "Vertex AI Labs · Remote", reason: "Aligns with your stated interest in moving into AI careers.", matchScore: 85 },
  { id: "rec-3", kind: "company", title: "BrightPath Health", subtitle: "Healthcare · Accessibility-focused", reason: "Strong accessibility culture matches your career interests and values.", matchScore: 88 },
  { id: "rec-4", kind: "company", title: "Vertex AI Labs", subtitle: "Artificial Intelligence", reason: "High hiring velocity in roles matching your target skill set.", matchScore: 84 },
  { id: "rec-5", kind: "course", title: "Advanced Accessibility Patterns", subtitle: "VisionEx Academy · 6 hours", reason: "Builds directly on your existing accessibility expertise.", matchScore: 90 },
  { id: "rec-6", kind: "course", title: "Prompt Engineering Fundamentals", subtitle: "VisionEx Academy · 4 hours", reason: "Supports your goal of moving into AI-focused roles.", matchScore: 82 },
  { id: "rec-7", kind: "certification", title: "AWS Certified Cloud Practitioner", subtitle: "Amazon Web Services", reason: "Closes a skill gap identified in your recent resume analysis.", matchScore: 76 },
  { id: "rec-8", kind: "certification", title: "Web Accessibility Specialist (WAS)", subtitle: "IAAP", reason: "Formalizes your existing accessibility skill for employers.", matchScore: 89 },
  { id: "rec-9", kind: "skill", title: "GraphQL", subtitle: "Trending in your target roles", reason: "Appears in 40% of the frontend roles you've viewed recently.", matchScore: 74 },
  { id: "rec-10", kind: "skill", title: "AI Prompt Engineering", subtitle: "Fast-growing demand", reason: "One of the fastest-growing skills in your target market.", matchScore: 81 },
];
