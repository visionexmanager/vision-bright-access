// ─── Career Center — DB row types (Phase 1 backend) ───────────────────────────
// Hand-written to match the deployed schema exactly (supabase/migrations/
// 20260705020000_career_center_roles.sql through 20260706080000_*.sql).
// The generated Supabase client types don't know about these tables yet, so
// service-layer calls cast `supabase.from("table") as any` and rely on these
// interfaces for shape — same convention as src/lib/types/academy-lms.ts.

export type CareerJobType = "full_time" | "part_time" | "contract" | "temporary" | "internship" | "freelance";
export type CareerExperienceLevel = "entry" | "mid" | "senior" | "lead";
export type CareerJobStatus = "draft" | "active" | "paused" | "closed";
export type CareerApplicationStatus = "applied" | "reviewing" | "interview" | "offer" | "accepted" | "rejected" | "withdrawn";
export type CareerVerificationStatus = "unverified" | "pending" | "verified";

export interface CareerProfileRow {
  id: string;
  user_id: string;
  headline: string | null;
  bio: string | null;
  location: string | null;
  avatar_url: string | null;
  resume_url: string | null;
  portfolio_url: string | null;
  github_url: string | null;
  linkedin_url: string | null;
  website_url: string | null;
  skills: string[];
  languages: string[];
  years_experience: number | null;
  followers_count: number;
  following_count: number;
  created_at: string;
  updated_at: string;
}

export interface CompanyRow {
  id: string;
  owner_user_id: string;
  name: string;
  slug: string;
  industry: string | null;
  size: string | null;
  website: string | null;
  description: string | null;
  logo_url: string | null;
  location: string | null;
  accessibility_rating: number | null;
  created_at: string;
  updated_at: string;
}

export interface JobRow {
  id: string;
  company_id: string;
  posted_by: string;
  title: string;
  description: string;
  location: string | null;
  salary_min: number | null;
  salary_max: number | null;
  currency: string;
  job_type: CareerJobType;
  remote: boolean;
  visa_sponsorship: boolean;
  accessibility_friendly: boolean;
  skills_required: string[];
  experience_level: CareerExperienceLevel;
  status: CareerJobStatus;
  applicant_count: number;
  optimization_score: number | null;
  source: string;
  external_ref: string | null;
  created_at: string;
  updated_at: string;
}

/** A job row with its posting company joined in — the shape most listing queries return. */
export interface JobWithCompany extends JobRow {
  company: CompanyRow | null;
}

export interface ApplicationRow {
  id: string;
  user_id: string;
  job_id: string;
  status: CareerApplicationStatus;
  resume_snapshot: string | null;
  cover_letter: string | null;
  ai_score: number | null;
  created_at: string;
  updated_at: string;
}

/** An application row with its job (and that job's company) joined in. */
export interface ApplicationWithJob extends ApplicationRow {
  job: JobWithCompany | null;
}

export interface CertificateRow {
  id: string;
  user_id: string;
  title: string;
  issuer: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  credential_id: string | null;
  credential_url: string | null;
  file_url: string | null;
  verification_status: CareerVerificationStatus;
  created_at: string;
}

export interface CareerGoalRow {
  id: string;
  user_id: string;
  title: string;
  priority: "low" | "medium" | "high";
  deadline: string | null;
  progress: number;
  estimated_completion: string | null;
  created_at: string;
  updated_at: string;
}

/** Career-scoped rows from the shared, site-wide `messages` table used for candidate↔employer/mentor DMs. */
export interface CareerMessageRow {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  attachment_url: string | null;
  is_ai_generated: boolean;
  is_read: boolean;
  created_at: string;
}

/** Career-scoped rows from the shared, site-wide `notifications` table (filtered by `category`). */
export interface CareerNotificationRow {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: "info" | "warning" | "success" | "error";
  category: string | null;
  is_read: boolean;
  created_at: string;
}
