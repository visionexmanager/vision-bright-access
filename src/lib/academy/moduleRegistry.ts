/**
 * Academy Module Registry
 *
 * A single source of truth for Academy modules and their live destinations.
 *
 * `status` values:
 *   "live"     — already implemented today (the Munir chat + onboarding +
 *                career compass flow currently living in src/pages/Academy.tsx)
 *   "planned"  — architecture prepared (types + service stubs exist), no UI yet
 */

export type AcademyModuleStatus = "live" | "planned";

export interface AcademyModuleDef {
  id: string;
  labelAr: string;
  labelEn: string;
  description: string;
  status: AcademyModuleStatus;
  /** Live route or section destination for this module. */
  plannedRoute: string;
}

export const academyModules: AcademyModuleDef[] = [
  {
    id: "ai-mentor",
    labelAr: "منير — المساعد الأكاديمي",
    labelEn: "Munir AI Mentor",
    description: "Conversational academic guidance, career compass, XP progression.",
    status: "live",
    plannedRoute: "/academy",
  },
  {
    id: "courses",
    labelAr: "الدورات",
    labelEn: "Courses",
    description: "Structured course catalog with modules and enrollments.",
    status: "live",
    plannedRoute: "/academy/courses",
  },
  {
    id: "instructors",
    labelAr: "المدرّسون",
    labelEn: "Instructors",
    description: "Instructor directory and profiles powering course authorship.",
    status: "live",
    plannedRoute: "/academy/instructor/apply",
  },
  {
    id: "student-services",
    labelAr: "خدمات الطالب",
    labelEn: "Student Services",
    description: "Tutoring, counseling, and academic advising requests.",
    status: "live",
    plannedRoute: "/academy#student-services-heading",
  },
  {
    id: "ai-learning",
    labelAr: "التعلّم الذكي",
    labelEn: "AI Learning",
    description: "AI-generated structured learning paths distinct from the chat assistant.",
    status: "live",
    plannedRoute: "/academy#ai-learning-center",
  },
  {
    id: "library",
    labelAr: "المكتبة",
    labelEn: "Library",
    description: "Books, videos, articles, and worksheets with bookmarking.",
    status: "live",
    plannedRoute: "/academy/library",
  },
  {
    id: "scholarships",
    labelAr: "المنح الدراسية",
    labelEn: "Scholarships",
    description: "Scholarship directory and application tracking.",
    status: "live",
    plannedRoute: "/academy/scholarships",
  },
  {
    id: "universities",
    labelAr: "الجامعات",
    labelEn: "Universities",
    description: "University directory with programs by country.",
    status: "live",
    plannedRoute: "/academy/universities",
  },
  {
    id: "community",
    labelAr: "المجتمع",
    labelEn: "Community Integration",
    description: "Academy-scoped posts layered on top of existing community rooms.",
    status: "live",
    plannedRoute: "/community",
  },
  {
    id: "certificates",
    labelAr: "الشهادات",
    labelEn: "Certificates",
    description: "Issued certificates for completed courses and achievements.",
    status: "live",
    plannedRoute: "/academy/certificates",
  },
  {
    id: "analytics",
    labelAr: "التحليلات",
    labelEn: "Analytics",
    description: "Per-student learning analytics events and summaries.",
    status: "live",
    plannedRoute: "/academy#personal-progress-heading",
  },
  {
    id: "notifications",
    labelAr: "الإشعارات",
    labelEn: "Notifications",
    description: "Academy-scoped notifications (new courses, due assignments, XP milestones).",
    status: "live",
    plannedRoute: "/academy/notifications",
  },
  {
    id: "accessibility",
    labelAr: "إمكانية الوصول",
    labelEn: "Accessibility",
    description: "Per-student accessibility preferences (motion, contrast, TTS rate, font scale).",
    status: "live",
    plannedRoute: "/academy/settings",
  },
];
