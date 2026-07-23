/**
 * Academy — Instructor Local Store (Phase 4, temporary)
 *
 * Client-only (localStorage) persistence for the instructor platform, same
 * honesty contract as lessonLocalStore.ts (Phase 3): data does not sync
 * across devices, is lost if site data is cleared, and mirrors the shape of
 * the future Supabase rows (academy-lms.ts / academy-instructor.ts) so a
 * later migration to real persistence is a drop-in swap.
 *
 * Also provides "merged" lookups that combine the static sample catalog
 * (mockCourses.ts) with locally-authored courses, so a course an instructor
 * creates and publishes here actually shows up in the real Catalog/Detail/
 * Player pages — end-to-end, not just inside the instructor dashboard.
 */

import type { AcademyCourseRow, AcademyCourseModuleRow, AcademyInstructorRow } from "@/lib/types/academy-modules";
import type {
  AcademyLessonRow,
  AcademyInstructorApplicationRow,
} from "@/lib/types/academy-lms";
import type { AcademyCourseReviewReplyRow, AcademyAnnouncementRow } from "@/lib/types/academy-instructor";
import {
  MOCK_COURSES, MOCK_INSTRUCTORS,
  getCourseById as getMockCourseById,
  getModulesForCourse as getMockModulesForCourse,
  getLessonsForModule as getMockLessonsForModule,
  getLessonById as getMockLessonById,
  getLessonsForCourse as getMockLessonsForCourse,
  getAllCategories as getMockCategories,
  type MockCourseFilters,
} from "./mockCourses";
import { readJSON, writeJSON } from "../storage/localStorageUtils";

const APPLICATION_KEY = "academy:instructor-application"; // single application per browser (demo scope)
const INSTRUCTOR_PROFILE_KEY = "academy:my-instructor-profile";
const COURSES_KEY = "academy:instructor-courses";
const MODULES_KEY = "academy:instructor-modules";
const LESSONS_KEY = "academy:instructor-lessons";
const ANNOUNCEMENTS_KEY = "academy:instructor-announcements";
const REVIEW_REPLIES_KEY = "academy:review-replies";

// ── Instructor Application ────────────────────────────────────────────────────

const BLANK_APPLICATION_DEFAULTS: Omit<AcademyInstructorApplicationRow, "id" | "user_id"> = {
  headline: "",
  bio: "",
  skills: [],
  status: "draft",
  submitted_at: null,
  experience_years: 0,
  expertise: [],
  languages: [],
  country: null,
  portfolio_url: null,
  identity_verification_status: "not_started",
  agreement_accepted: false,
  terms_accepted: false,
  review_note: null,
  reviewed_at: null,
  reviewed_by_user_id: null,
};

export function getMyApplication(userId: string): AcademyInstructorApplicationRow | null {
  const all = readJSON<Record<string, AcademyInstructorApplicationRow>>(APPLICATION_KEY, {});
  return all[userId] ?? null;
}

export function saveApplicationDraft(
  userId: string,
  updates: Partial<Omit<AcademyInstructorApplicationRow, "id" | "user_id" | "status">>
): AcademyInstructorApplicationRow {
  const all = readJSON<Record<string, AcademyInstructorApplicationRow>>(APPLICATION_KEY, {});
  const existing = all[userId];
  const next: AcademyInstructorApplicationRow = {
    id: existing?.id ?? crypto.randomUUID(),
    user_id: userId,
    ...BLANK_APPLICATION_DEFAULTS,
    ...existing,
    ...updates,
    status: existing?.status ?? "draft",
  };
  all[userId] = next;
  writeJSON(APPLICATION_KEY, all);
  return next;
}

/** Lets a rejected applicant edit and resubmit — explicitly resets status, not a client-only patch. */
export function resetApplicationToDraft(userId: string): AcademyInstructorApplicationRow | null {
  const all = readJSON<Record<string, AcademyInstructorApplicationRow>>(APPLICATION_KEY, {});
  const existing = all[userId];
  if (!existing) return null;
  const next: AcademyInstructorApplicationRow = {
    ...existing,
    status: "draft",
    submitted_at: null,
    review_note: null,
    reviewed_at: null,
    reviewed_by_user_id: null,
  };
  all[userId] = next;
  writeJSON(APPLICATION_KEY, all);
  return next;
}

export function submitApplication(userId: string): AcademyInstructorApplicationRow | null {
  const all = readJSON<Record<string, AcademyInstructorApplicationRow>>(APPLICATION_KEY, {});
  const existing = all[userId];
  if (!existing || !existing.agreement_accepted || !existing.terms_accepted) return null;
  const next: AcademyInstructorApplicationRow = { ...existing, status: "pending", submitted_at: new Date().toISOString() };
  all[userId] = next;
  writeJSON(APPLICATION_KEY, all);
  return next;
}

export function listAllApplications(): AcademyInstructorApplicationRow[] {
  const all = readJSON<Record<string, AcademyInstructorApplicationRow>>(APPLICATION_KEY, {});
  return Object.values(all);
}

export function setApplicationStatus(
  userId: string,
  status: AcademyInstructorApplicationRow["status"],
  reviewNote: string | null,
  adminUserId: string
): AcademyInstructorApplicationRow | null {
  const all = readJSON<Record<string, AcademyInstructorApplicationRow>>(APPLICATION_KEY, {});
  const existing = all[userId];
  if (!existing) return null;
  const next: AcademyInstructorApplicationRow = {
    ...existing,
    status,
    review_note: reviewNote,
    reviewed_at: new Date().toISOString(),
    reviewed_by_user_id: adminUserId,
  };
  all[userId] = next;
  writeJSON(APPLICATION_KEY, all);
  if (status === "approved") getOrCreateMyInstructorProfile(userId);
  return next;
}

// ── My Instructor Profile ─────────────────────────────────────────────────────

export function getMyInstructorProfile(userId: string): AcademyInstructorRow | null {
  const all = readJSON<Record<string, AcademyInstructorRow>>(INSTRUCTOR_PROFILE_KEY, {});
  return all[userId] ?? null;
}

/** Creates the instructor profile from an approved application, if one doesn't exist yet. */
export function getOrCreateMyInstructorProfile(userId: string): AcademyInstructorRow | null {
  const existing = getMyInstructorProfile(userId);
  if (existing) return existing;

  const application = getMyApplication(userId);
  if (!application || application.status !== "approved") return null;

  const profile: AcademyInstructorRow = {
    id: `instructor-${userId}`,
    user_id: userId,
    name: application.headline || "مدرّس جديد",
    headline: application.headline || null,
    bio: application.bio || null,
    avatar_url: null,
    subjects: application.expertise,
    rating: null,
    verified: false,
    social_links: application.portfolio_url ? { website: application.portfolio_url } : {},
    skills: application.skills,
    courses_count: 0,
    students_count: 0,
    created_at: new Date().toISOString(),
    cover_image_url: null,
    expertise: application.expertise,
    languages: application.languages,
    country: application.country,
    certifications: [],
    portfolio_url: application.portfolio_url,
    level: "new",
    organization_id: null,
  };

  const all = readJSON<Record<string, AcademyInstructorRow>>(INSTRUCTOR_PROFILE_KEY, {});
  all[userId] = profile;
  writeJSON(INSTRUCTOR_PROFILE_KEY, all);
  return profile;
}

export function updateMyInstructorProfile(
  userId: string,
  updates: Partial<Omit<AcademyInstructorRow, "id" | "user_id">>
): AcademyInstructorRow | null {
  const all = readJSON<Record<string, AcademyInstructorRow>>(INSTRUCTOR_PROFILE_KEY, {});
  const existing = all[userId];
  if (!existing) return null;
  const next = { ...existing, ...updates };
  all[userId] = next;
  writeJSON(INSTRUCTOR_PROFILE_KEY, all);
  return next;
}

export function getInstructorByIdAny(instructorId: string): AcademyInstructorRow | null {
  const local = readJSON<Record<string, AcademyInstructorRow>>(INSTRUCTOR_PROFILE_KEY, {});
  const fromLocal = Object.values(local).find((i) => i.id === instructorId);
  if (fromLocal) return fromLocal;
  return MOCK_INSTRUCTORS.find((i) => i.id === instructorId) ?? null;
}

// ── My Courses (create / edit / duplicate / publish / archive / delete) ─────

interface CourseBundle {
  course: AcademyCourseRow;
  modules: AcademyCourseModuleRow[];
  lessons: AcademyLessonRow[];
}

function readCourses(): Record<string, AcademyCourseRow> {
  return readJSON(COURSES_KEY, {});
}
function readModules(): Record<string, AcademyCourseModuleRow[]> {
  return readJSON(MODULES_KEY, {});
}
function readLessons(): Record<string, AcademyLessonRow[]> {
  return readJSON(LESSONS_KEY, {});
}

export function getMyCoursesLocal(instructorId: string): AcademyCourseRow[] {
  return Object.values(readCourses()).filter((c) => c.instructor_id === instructorId);
}

/** All courses (mock + local) by an instructor, for public profile viewing. */
export function getCoursesByInstructorAny(instructorId: string): AcademyCourseRow[] {
  const local = Object.values(readCourses()).filter((c) => c.instructor_id === instructorId && c.published);
  const mock = MOCK_COURSES.filter((c) => c.instructor_id === instructorId);
  return [...mock, ...local];
}

export function getCourseByIdAny(id: string): AcademyCourseRow | null {
  return readCourses()[id] ?? getMockCourseById(id);
}

export function getModulesForCourseAny(courseId: string): AcademyCourseModuleRow[] {
  const local = readModules()[courseId];
  if (local) return [...local].sort((a, b) => a.order_index - b.order_index);
  return getMockModulesForCourse(courseId);
}

export function getLessonsForModuleAny(courseId: string, moduleId: string): AcademyLessonRow[] {
  const localLessons = readLessons()[courseId];
  if (localLessons) return localLessons.filter((l) => l.module_id === moduleId).sort((a, b) => a.order_index - b.order_index);
  return getMockLessonsForModule(moduleId);
}

export function getLessonsForCourseAny(courseId: string): AcademyLessonRow[] {
  const localLessons = readLessons()[courseId];
  if (localLessons) return [...localLessons].sort((a, b) => a.order_index - b.order_index);
  return getMockLessonsForCourse(courseId);
}

export function getLessonByIdAny(courseId: string, lessonId: string): AcademyLessonRow | null {
  const localLessons = readLessons()[courseId];
  if (localLessons) return localLessons.find((l) => l.id === lessonId) ?? null;
  return getMockLessonById(lessonId);
}

export function searchCoursesAny(filters: MockCourseFilters = {}): AcademyCourseRow[] {
  const localPublished = Object.values(readCourses()).filter((c) => c.published);
  const merged = [...MOCK_COURSES, ...localPublished];

  let results = merged;
  if (filters.query?.trim()) {
    const q = filters.query.trim().toLowerCase();
    results = results.filter((c) =>
      c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || c.tags.some((t) => t.toLowerCase().includes(q))
    );
  }
  if (filters.category) results = results.filter((c) => c.category === filters.category);
  if (filters.difficulty) results = results.filter((c) => c.difficulty === filters.difficulty);
  if (filters.source) results = results.filter((c) => c.source === filters.source);

  if (filters.sort === "popular") {
    results = [...results].sort((a, b) => b.students_count - a.students_count);
  } else if (filters.sort === "new") {
    results = [...results].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } else {
    results = [...results].sort((a, b) => (b.rating_avg ?? 0) - (a.rating_avg ?? 0));
  }
  return results;
}

export function getAllCategoriesAny(): string[] {
  const localCategories = Object.values(readCourses()).map((c) => c.category);
  return Array.from(new Set([...getMockCategories(), ...localCategories]));
}

export function createCourseLocal(instructorId: string, data: Partial<AcademyCourseRow>): AcademyCourseRow {
  const courses = readCourses();
  const id = `local-course-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const course: AcademyCourseRow = {
    id,
    title: data.title ?? "دورة جديدة بدون عنوان",
    description: data.description ?? "",
    level: data.level ?? "",
    subject: data.subject ?? "",
    instructor_id: instructorId,
    cover_image_url: null,
    published: false,
    created_at: now,
    updated_at: now,
    status: "draft",
    gallery_urls: [],
    source: "marketplace",
    difficulty: data.difficulty ?? "beginner",
    language: data.language ?? "العربية",
    trailer_video_url: null,
    youtube_video_id: null,
    category: data.category ?? "عام",
    tags: data.tags ?? [],
    duration_minutes: 0,
    is_free: data.is_free ?? true,
    price_vx: data.price_vx ?? null,
    rating_avg: null,
    rating_count: 0,
    students_count: 0,
    learning_outcomes: data.learning_outcomes ?? [],
    requirements: data.requirements ?? [],
  };
  courses[id] = course;
  writeJSON(COURSES_KEY, courses);
  return course;
}

export function updateCourseLocal(courseId: string, updates: Partial<AcademyCourseRow>): AcademyCourseRow | null {
  const courses = readCourses();
  const existing = courses[courseId];
  if (!existing) return null;
  const next = { ...existing, ...updates, updated_at: new Date().toISOString() };
  courses[courseId] = next;
  writeJSON(COURSES_KEY, courses);
  return next;
}

export function setCourseStatusLocal(courseId: string, status: AcademyCourseRow["status"]): AcademyCourseRow | null {
  return updateCourseLocal(courseId, { status, published: status === "published" });
}

export function deleteCourseLocal(courseId: string): void {
  const courses = readCourses();
  delete courses[courseId];
  writeJSON(COURSES_KEY, courses);

  const modules = readModules();
  delete modules[courseId];
  writeJSON(MODULES_KEY, modules);

  const lessons = readLessons();
  delete lessons[courseId];
  writeJSON(LESSONS_KEY, lessons);
}

export function duplicateCourseLocal(courseId: string): AcademyCourseRow | null {
  const source = getCourseByIdAny(courseId);
  if (!source) return null;
  const newCourse = createCourseLocal(source.instructor_id, { ...source, title: `${source.title} (نسخة)` });

  const sourceModules = getModulesForCourseAny(courseId);
  const modules = readModules();
  const lessons = readLessons();
  const newModules: AcademyCourseModuleRow[] = [];
  const newLessons: AcademyLessonRow[] = [];

  sourceModules.forEach((m) => {
    const newModuleId = `local-mod-${crypto.randomUUID()}`;
    newModules.push({ ...m, id: newModuleId, course_id: newCourse.id });
    const sourceLessons = getLessonsForModuleAny(courseId, m.id);
    sourceLessons.forEach((l) => {
      newLessons.push({ ...l, id: `local-lesson-${crypto.randomUUID()}`, module_id: newModuleId, course_id: newCourse.id });
    });
  });

  modules[newCourse.id] = newModules;
  lessons[newCourse.id] = newLessons;
  writeJSON(MODULES_KEY, modules);
  writeJSON(LESSONS_KEY, lessons);
  return newCourse;
}

// ── Modules & Lessons (builder) ───────────────────────────────────────────────

export function saveModulesForCourse(courseId: string, modulesList: AcademyCourseModuleRow[]): void {
  const modules = readModules();
  modules[courseId] = modulesList;
  writeJSON(MODULES_KEY, modules);
}

export function saveLessonsForCourse(courseId: string, lessonsList: AcademyLessonRow[]): void {
  const lessons = readLessons();
  lessons[courseId] = lessonsList;
  writeJSON(LESSONS_KEY, lessons);
}

// ── Announcements ──────────────────────────────────────────────────────────────

export function getAnnouncementsForInstructor(instructorId: string): AcademyAnnouncementRow[] {
  const all = readJSON<AcademyAnnouncementRow[]>(ANNOUNCEMENTS_KEY, []);
  return all.filter((a) => a.instructor_id === instructorId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function createAnnouncement(
  instructorId: string,
  title: string,
  body: string,
  courseId: string | null
): AcademyAnnouncementRow {
  const all = readJSON<AcademyAnnouncementRow[]>(ANNOUNCEMENTS_KEY, []);
  const announcement: AcademyAnnouncementRow = {
    id: crypto.randomUUID(),
    instructor_id: instructorId,
    course_id: courseId,
    title,
    body,
    pinned: false,
    created_at: new Date().toISOString(),
  };
  all.push(announcement);
  writeJSON(ANNOUNCEMENTS_KEY, all);
  return announcement;
}

export function deleteAnnouncement(announcementId: string): void {
  const all = readJSON<AcademyAnnouncementRow[]>(ANNOUNCEMENTS_KEY, []);
  writeJSON(ANNOUNCEMENTS_KEY, all.filter((a) => a.id !== announcementId));
}

// ── Review replies ────────────────────────────────────────────────────────────

export function getReviewReply(reviewId: string): AcademyCourseReviewReplyRow | null {
  const all = readJSON<Record<string, AcademyCourseReviewReplyRow>>(REVIEW_REPLIES_KEY, {});
  return all[reviewId] ?? null;
}

export function saveReviewReply(reviewId: string, instructorId: string, body: string): AcademyCourseReviewReplyRow {
  const all = readJSON<Record<string, AcademyCourseReviewReplyRow>>(REVIEW_REPLIES_KEY, {});
  const reply: AcademyCourseReviewReplyRow = {
    id: all[reviewId]?.id ?? crypto.randomUUID(),
    review_id: reviewId,
    instructor_id: instructorId,
    body,
    created_at: new Date().toISOString(),
  };
  all[reviewId] = reply;
  writeJSON(REVIEW_REPLIES_KEY, all);
  return reply;
}
