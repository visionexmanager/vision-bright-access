export type OrgKind = "school" | "nursery" | "center" | "library" | "nonprofit";
export type OrgRole = "owner" | "admin" | "teacher" | "parent" | "student" | "staff";

export interface Organization {
  id: string;
  slug: string;
  name: string;
  kind: OrgKind;
  domain: string | null;
  logo_url: string | null;
  branding: Record<string, unknown>;
  settings: Record<string, unknown>;
  storage_quota_mb: number;
  status: "active" | "suspended";
  created_by: string | null;
  created_at: string;
}

export interface OrgMember {
  org_id: string;
  user_id: string;
  role: OrgRole;
  status: "active" | "invited" | "suspended";
  display_name: string | null;
  created_at: string;
}

export interface School {
  id: string;
  org_id: string;
  name: string;
  kind: string;
  address: string | null;
  logo_url: string | null;
  order_index: number;
  created_at: string;
}

export interface ClassRoom {
  id: string;
  org_id: string;
  school_id: string | null;
  name: string;
  grade: string | null;
  subject: string | null;
  teacher_id: string | null;
  created_at: string;
}

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export interface AttendanceRecord {
  id: string;
  org_id: string;
  class_id: string;
  student_id: string;
  date: string;
  status: AttendanceStatus;
  note: string | null;
  recorded_by: string | null;
  created_at: string;
}

export interface Assignment {
  id: string;
  org_id: string;
  class_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  points: number;
  created_by: string | null;
  created_at: string;
}

export interface AssignmentSubmission {
  id: string;
  org_id: string;
  assignment_id: string;
  student_id: string;
  content: string | null;
  file_url: string | null;
  grade: number | null;
  status: "submitted" | "graded" | "returned";
  submitted_at: string;
}

export interface TimetableEntry {
  id: string;
  org_id: string;
  class_id: string;
  day_of_week: number;
  period: number;
  subject: string;
  start_time: string | null;
  end_time: string | null;
  teacher_id: string | null;
  recurring: boolean;
  created_at: string;
}

export interface Exam {
  id: string;
  org_id: string;
  class_id: string;
  title: string;
  subject: string | null;
  exam_date: string | null;
  total_marks: number;
  created_at: string;
}

export interface ExamResult {
  id: string;
  org_id: string;
  exam_id: string;
  student_id: string;
  marks: number;
  grade: string | null;
  created_at: string;
}

export type ResourceType = "book" | "file" | "video" | "activity" | "exam" | "link";

export interface OrgResource {
  id: string;
  org_id: string;
  type: ResourceType;
  title: string;
  description: string | null;
  url: string | null;
  emoji: string;
  category: string | null;
  created_by: string | null;
  created_at: string;
}

export type AnnouncementKind = "announcement" | "meeting" | "survey";
export type Audience = "all" | "teachers" | "parents" | "students";

export interface Announcement {
  id: string;
  org_id: string;
  kind: AnnouncementKind;
  title: string;
  body: string | null;
  audience: Audience;
  meeting_at: string | null;
  link: string | null;
  author_id: string | null;
  created_at: string;
}

export interface OrgCertificate {
  id: string;
  org_id: string;
  student_id: string;
  student_name: string;
  title: string;
  description: string | null;
  verify_code: string;
  signature: string | null;
  issued_by: string | null;
  issued_at: string;
  status: "valid" | "revoked";
}

export interface CertificateVerification {
  valid: boolean;
  status?: string;
  student_name?: string;
  title?: string;
  org_name?: string;
  issued_at?: string;
  signature?: string;
}

export interface SchoolDashboard {
  students: number;
  teachers: number;
  classes: number;
  assignments: number;
  attendance_rate: number;
  attendance_marked: number;
  avg_marks: number;
}

export interface OrgAnalytics {
  attendance_rate_30d: number;
  submissions: number;
  graded: number;
  avg_marks: number;
  certificates: number;
  resources: number;
}

/** A membership joined with its organization (for the org switcher). */
export interface MyMembership extends OrgMember {
  organization: Organization | null;
}
