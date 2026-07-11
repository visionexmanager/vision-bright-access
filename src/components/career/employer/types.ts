export type EmployerSection =
  | "overview"
  | "postJob"
  | "manageJobs"
  | "candidates"
  | "aiScreening"
  | "interviews"
  | "analytics"
  | "team"
  | "messages"
  | "settings";

export type PipelineStage = "applied" | "screening" | "interview" | "shortlisted" | "offered" | "hired" | "rejected";

export type JobStatus = "active" | "draft" | "closed" | "paused";

export interface JobPosting {
  id: string;
  title: string;
  description: string;
  requirements: string[];
  skills: string[];
  salaryMin: number;
  salaryMax: number;
  currency: string;
  type: string;
  location: string;
  workMode: "remote" | "hybrid" | "onsite";
  visaSponsorship: boolean;
  accessibilityTags: string[];
  status: JobStatus;
  postedDate: string;
  applicantCount: number;
  optimizationScore: number;
}

export interface CandidateNote {
  id: string;
  author: string;
  text: string;
  date: string;
}

export interface CandidateInterviewRecord {
  id: string;
  mode: "hr" | "technical" | "behavioral";
  date: string;
  score: number;
}

export interface Candidate {
  id: string;
  name: string;
  avatarColor: string;
  headline: string;
  location: string;
  appliedJobId: string;
  appliedJobTitle: string;
  stage: PipelineStage;
  matchScore: number;
  skillMatch: number;
  experienceMatch: number;
  cultureFit: number;
  salaryFit: number;
  riskScore: number;
  missingSkills: string[];
  matchedSkills: string[];
  skills: string[];
  experienceYears: number;
  education: string;
  portfolioUrl: string;
  resumeSummary: string;
  tags: string[];
  notes: CandidateNote[];
  interviewHistory: CandidateInterviewRecord[];
  source: string;
  appliedDate: string;
}

export type InterviewMode = "hr" | "technical" | "behavioral";
export type InterviewFormat = "async_video" | "async_voice" | "live";
export type InterviewStatus = "scheduled" | "completed";

export interface InterviewScores {
  candidateScore: number;
  communication: number;
  confidence: number;
  technicalAccuracy: number;
}

export interface EmployerInterview {
  id: string;
  candidateId: string;
  candidateName: string;
  jobTitle: string;
  mode: InterviewMode;
  format: InterviewFormat;
  status: InterviewStatus;
  scheduledDate: string;
  scores: InterviewScores | null;
}

export type TeamRole = "admin" | "hr" | "recruiter" | "viewer";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  avatarColor: string;
  joinedDate: string;
}

export interface EmployerMessageThread {
  id: string;
  candidateName: string;
  candidateColor: string;
  jobTitle: string;
  subject: string;
  preview: string;
  body: string;
  date: string;
  read: boolean;
}

export interface CompanyProfile {
  name: string;
  industry: string;
  size: string;
  website: string;
  description: string;
  logoColor: string;
}

export interface AIRecommendation {
  id: string;
  text: string;
}

export interface ChartPoint {
  label: string;
  value: number;
}
