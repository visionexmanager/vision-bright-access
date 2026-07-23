/**
 * Academy — Certificate Local Store (Phase 6, temporary)
 * Same localStorage contract as every other *LocalStore.ts file. Eligibility
 * is computed for real from existing Phase 3/6 local stores (lesson
 * progress, quiz attempts, assignment submissions) — nothing here is faked.
 */

import type { AcademyCertificateRow, AcademyCourseRow } from "@/lib/types/academy-modules";
import type { AcademyCertificateVerificationRow } from "@/lib/types/academy-certificate";
import { getCourseByIdAny, getLessonsForCourseAny, getInstructorByIdAny } from "./instructorLocalStore";
import { getCourseProgress } from "./lessonLocalStore";
import { getQuizForLessonAny, getQuizAttempts, getAssignmentForLessonAny, getAssignmentSubmissions } from "./assessmentLocalStore";
import { readJSON, writeJSON } from "../storage/localStorageUtils";

const CERTIFICATES_KEY = "academy:certificates";
const VERIFICATIONS_KEY = "academy:certificate-verifications";

export interface CertificateEligibility {
  eligible: boolean;
  reasons: string[];
}

export function checkCertificateEligibility(userId: string, courseId: string): CertificateEligibility {
  const course = getCourseByIdAny(courseId);
  if (!course) return { eligible: false, reasons: ["الدورة غير موجودة."] };

  const lessons = getLessonsForCourseAny(courseId);
  if (lessons.length === 0) return { eligible: false, reasons: ["لا تحتوي الدورة على دروس بعد."] };

  const reasons: string[] = [];

  // 1. Course completion — every lesson marked complete.
  const progress = getCourseProgress(courseId);
  const completedIds = new Set(progress.filter((p) => p.completed).map((p) => p.lesson_id));
  const incompleteCount = lessons.filter((l) => !completedIds.has(l.id)).length;
  if (incompleteCount > 0) reasons.push(`أكمل ${incompleteCount} درساً متبقياً على الأقل.`);

  // 2. Final assessment(s) passed — every quiz-kind lesson needs a passing attempt.
  const quizLessons = lessons.filter((l) => l.kind === "quiz");
  for (const lesson of quizLessons) {
    const detail = getQuizForLessonAny(lesson.id);
    if (!detail) continue;
    const attempts = getQuizAttempts(userId, detail.quiz.id);
    const passed = attempts.some((a) => a.passed);
    if (!passed) reasons.push(`اجتز اختبار "${lesson.title}" بنجاح.`);
  }

  // 3. Required assignments submitted.
  const assignmentLessons = lessons.filter((l) => l.kind === "assignment");
  for (const lesson of assignmentLessons) {
    const assignment = getAssignmentForLessonAny(lesson.id);
    if (!assignment) continue;
    const submissions = getAssignmentSubmissions(userId, assignment.id);
    if (submissions.length === 0) reasons.push(`سلّم واجب "${lesson.title}".`);
  }

  return { eligible: reasons.length === 0, reasons };
}

function generateCertificateNumber(): string {
  const year = new Date().getFullYear();
  const random = crypto.randomUUID().split("-")[0].toUpperCase();
  return `VX-${year}-${random}`;
}

export function getMyCertificates(userId: string): AcademyCertificateRow[] {
  const all = readJSON<Record<string, AcademyCertificateRow>>(CERTIFICATES_KEY, {});
  return Object.values(all).filter((c) => c.user_id === userId);
}

/** All certificates issued for a set of courses — used by the instructor dashboard. */
export function getCertificatesForCourses(courseIds: string[]): AcademyCertificateRow[] {
  const all = readJSON<Record<string, AcademyCertificateRow>>(CERTIFICATES_KEY, {});
  const idSet = new Set(courseIds);
  return Object.values(all).filter((c) => c.course_id && idSet.has(c.course_id));
}

export function getCertificateForCourse(userId: string, courseId: string): AcademyCertificateRow | null {
  return getMyCertificates(userId).find((c) => c.course_id === courseId) ?? null;
}

export function issueCertificateLocal(userId: string, courseId: string, studentName: string): AcademyCertificateRow | null {
  const existing = getCertificateForCourse(userId, courseId);
  if (existing) return existing;

  const eligibility = checkCertificateEligibility(userId, courseId);
  if (!eligibility.eligible) return null;

  const course: AcademyCourseRow | null = getCourseByIdAny(courseId);
  if (!course) return null;
  const instructor = getInstructorByIdAny(course.instructor_id);

  const id = crypto.randomUUID();
  const certificateNumber = generateCertificateNumber();
  const now = new Date().toISOString();
  const verificationUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/academy/verify/${certificateNumber}`;

  const certificate: AcademyCertificateRow = {
    id, user_id: userId, course_id: courseId,
    title: `شهادة إتمام: ${course.title}`,
    issued_at: now,
    certificate_url: null,
    certificate_number: certificateNumber,
    student_name: studentName,
    course_name: course.title,
    instructor_name: instructor?.name ?? "أكاديمية Visionex",
    completion_date: now,
    skills: course.tags,
    verification_url: verificationUrl,
    qr_code_data: verificationUrl,
    signature_name: instructor?.name ?? "فريق أكاديمية Visionex",
    signature_image_url: null,
    template_id: "classic",
    status: "valid",
  };

  const all = readJSON<Record<string, AcademyCertificateRow>>(CERTIFICATES_KEY, {});
  all[id] = certificate;
  writeJSON(CERTIFICATES_KEY, all);
  return certificate;
}

export function getCertificateByNumber(certificateNumber: string): AcademyCertificateRow | null {
  const all = readJSON<Record<string, AcademyCertificateRow>>(CERTIFICATES_KEY, {});
  return Object.values(all).find((c) => c.certificate_number === certificateNumber) ?? null;
}

export function revokeCertificateLocal(certificateId: string): boolean {
  const all = readJSON<Record<string, AcademyCertificateRow>>(CERTIFICATES_KEY, {});
  const cert = all[certificateId];
  if (!cert) return false;
  all[certificateId] = { ...cert, status: "revoked" };
  writeJSON(CERTIFICATES_KEY, all);
  return true;
}

/** Appends to an audit log — never mutates past entries (tamper-proof-structure prep). */
export function verifyCertificateLocal(certificateNumber: string): { certificate: AcademyCertificateRow | null; log: AcademyCertificateVerificationRow } {
  const certificate = getCertificateByNumber(certificateNumber);
  const log: AcademyCertificateVerificationRow = {
    id: crypto.randomUUID(),
    certificate_id: certificate?.id ?? "",
    certificate_number: certificateNumber,
    verified_at: new Date().toISOString(),
    result: certificate ? (certificate.status === "valid" ? "valid" : "revoked") : "not_found",
  };
  const logs = readJSON<AcademyCertificateVerificationRow[]>(VERIFICATIONS_KEY, []);
  logs.push(log);
  writeJSON(VERIFICATIONS_KEY, logs);
  return { certificate, log };
}

export function getVerificationLog(certificateId: string): AcademyCertificateVerificationRow[] {
  const logs = readJSON<AcademyCertificateVerificationRow[]>(VERIFICATIONS_KEY, []);
  return logs.filter((l) => l.certificate_id === certificateId);
}
