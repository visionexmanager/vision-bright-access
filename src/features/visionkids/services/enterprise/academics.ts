import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type {
  ClassRoom, AttendanceRecord, Assignment, AssignmentSubmission, TimetableEntry,
  Exam, ExamResult, AttendanceStatus,
} from "@/features/visionkids/types/enterprise.types";

// ── Classes + roster ─────────────────────────────────────────────────────────
export async function fetchClasses(orgId: string): Promise<ClassRoom[]> {
  const { data, error } = await kidsDb
    .from("kids_classes").select("*").eq("org_id", orgId).order("created_at")
    .returns<ClassRoom[]>();
  if (error) throw error;
  return data ?? [];
}

export async function createClass(input: { orgId: string; schoolId?: string; name: string; grade?: string; subject?: string; teacherId?: string }): Promise<ClassRoom> {
  const { data, error } = await kidsDb
    .from("kids_classes")
    .insert({ org_id: input.orgId, school_id: input.schoolId ?? null, name: input.name, grade: input.grade ?? null, subject: input.subject ?? null, teacher_id: input.teacherId ?? null })
    .select("*").single();
  if (error) throw error;
  return data as ClassRoom;
}

export async function fetchClassRoster(classId: string): Promise<{ student_id: string }[]> {
  const { data, error } = await kidsDb
    .from("kids_class_students").select("student_id").eq("class_id", classId)
    .returns<{ student_id: string }[]>();
  if (error) throw error;
  return data ?? [];
}

// ── Attendance ───────────────────────────────────────────────────────────────
export async function fetchAttendance(classId: string, date: string): Promise<AttendanceRecord[]> {
  const { data, error } = await kidsDb
    .from("kids_attendance").select("*").eq("class_id", classId).eq("date", date)
    .returns<AttendanceRecord[]>();
  if (error) throw error;
  return data ?? [];
}

export async function markAttendance(classId: string, studentId: string, date: string, status: AttendanceStatus): Promise<void> {
  const { error } = await kidsDb.rpc("mark_kids_attendance", { _class_id: classId, _student_id: studentId, _date: date, _status: status });
  if (error) throw error;
}

// ── Assignments ──────────────────────────────────────────────────────────────
export async function fetchAssignments(orgId: string, classId?: string): Promise<Assignment[]> {
  let query = kidsDb.from("kids_assignments").select("*").eq("org_id", orgId).order("due_date", { ascending: true });
  if (classId) query = query.eq("class_id", classId);
  const { data, error } = await query.returns<Assignment[]>();
  if (error) throw error;
  return data ?? [];
}

export async function createAssignment(input: { orgId: string; classId: string; title: string; description?: string; dueDate?: string; points?: number }): Promise<Assignment> {
  const { data, error } = await kidsDb
    .from("kids_assignments")
    .insert({ org_id: input.orgId, class_id: input.classId, title: input.title, description: input.description ?? null, due_date: input.dueDate ?? null, points: input.points ?? 100 })
    .select("*").single();
  if (error) throw error;
  return data as Assignment;
}

export async function fetchSubmissions(assignmentId: string): Promise<AssignmentSubmission[]> {
  const { data, error } = await kidsDb
    .from("kids_assignment_submissions").select("*").eq("assignment_id", assignmentId)
    .returns<AssignmentSubmission[]>();
  if (error) throw error;
  return data ?? [];
}

// ── Timetable ────────────────────────────────────────────────────────────────
export async function fetchTimetable(classId: string): Promise<TimetableEntry[]> {
  const { data, error } = await kidsDb
    .from("kids_timetable").select("*").eq("class_id", classId).order("day_of_week").order("period")
    .returns<TimetableEntry[]>();
  if (error) throw error;
  return data ?? [];
}

export async function createTimetableEntry(input: { orgId: string; classId: string; dayOfWeek: number; period: number; subject: string; startTime?: string; endTime?: string }): Promise<void> {
  const { error } = await kidsDb.from("kids_timetable").insert({
    org_id: input.orgId, class_id: input.classId, day_of_week: input.dayOfWeek, period: input.period,
    subject: input.subject, start_time: input.startTime ?? null, end_time: input.endTime ?? null,
  });
  if (error) throw error;
}

// ── Exams ────────────────────────────────────────────────────────────────────
export async function fetchExams(orgId: string, classId?: string): Promise<Exam[]> {
  let query = kidsDb.from("kids_exams").select("*").eq("org_id", orgId).order("exam_date", { ascending: false });
  if (classId) query = query.eq("class_id", classId);
  const { data, error } = await query.returns<Exam[]>();
  if (error) throw error;
  return data ?? [];
}

export async function createExam(input: { orgId: string; classId: string; title: string; subject?: string; examDate?: string; totalMarks?: number }): Promise<Exam> {
  const { data, error } = await kidsDb
    .from("kids_exams")
    .insert({ org_id: input.orgId, class_id: input.classId, title: input.title, subject: input.subject ?? null, exam_date: input.examDate ?? null, total_marks: input.totalMarks ?? 100 })
    .select("*").single();
  if (error) throw error;
  return data as Exam;
}

export async function fetchExamResults(examId: string): Promise<ExamResult[]> {
  const { data, error } = await kidsDb
    .from("kids_exam_results").select("*").eq("exam_id", examId)
    .returns<ExamResult[]>();
  if (error) throw error;
  return data ?? [];
}
