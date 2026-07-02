/**
 * Academy Module Registry (Phase 1 architecture prep)
 *
 * A single source of truth listing every planned Academy module. This is an
 * EXTENSION POINT for future phases — e.g. a Phase 2 sidebar/nav could map
 * over `academyModules` to render module links, or a future router could
 * generate `/academy/:moduleId` routes from `plannedRoute`.
 *
 * Nothing imports this yet. It is not wired into App.tsx routing or the
 * Navbar — adding real pages/routes is explicitly out of scope for Phase 1.
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
  /** Reserved path for when this module gets its own page. Not registered in App.tsx yet. */
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
    status: "planned",
    plannedRoute: "/academy/courses",
  },
  {
    id: "instructors",
    labelAr: "المدرّسون",
    labelEn: "Instructors",
    description: "Instructor directory and profiles powering course authorship.",
    status: "planned",
    plannedRoute: "/academy/instructors",
  },
  {
    id: "student-services",
    labelAr: "خدمات الطالب",
    labelEn: "Student Services",
    description: "Tutoring, counseling, and academic advising requests.",
    status: "planned",
    plannedRoute: "/academy/student-services",
  },
  {
    id: "ai-learning",
    labelAr: "التعلّم الذكي",
    labelEn: "AI Learning",
    description: "AI-generated structured learning paths distinct from the chat assistant.",
    status: "planned",
    plannedRoute: "/academy/ai-learning",
  },
  {
    id: "library",
    labelAr: "المكتبة",
    labelEn: "Library",
    description: "Books, videos, articles, and worksheets with bookmarking.",
    status: "planned",
    plannedRoute: "/academy/library",
  },
  {
    id: "scholarships",
    labelAr: "المنح الدراسية",
    labelEn: "Scholarships",
    description: "Scholarship directory and application tracking.",
    status: "planned",
    plannedRoute: "/academy/scholarships",
  },
  {
    id: "universities",
    labelAr: "الجامعات",
    labelEn: "Universities",
    description: "University directory with programs by country.",
    status: "planned",
    plannedRoute: "/academy/universities",
  },
  {
    id: "community",
    labelAr: "المجتمع",
    labelEn: "Community Integration",
    description: "Academy-scoped posts layered on top of existing community rooms.",
    status: "planned",
    plannedRoute: "/academy/community",
  },
  {
    id: "certificates",
    labelAr: "الشهادات",
    labelEn: "Certificates",
    description: "Issued certificates for completed courses and achievements.",
    status: "planned",
    plannedRoute: "/academy/certificates",
  },
  {
    id: "analytics",
    labelAr: "التحليلات",
    labelEn: "Analytics",
    description: "Per-student learning analytics events and summaries.",
    status: "planned",
    plannedRoute: "/academy/analytics",
  },
  {
    id: "notifications",
    labelAr: "الإشعارات",
    labelEn: "Notifications",
    description: "Academy-scoped notifications (new courses, due assignments, XP milestones).",
    status: "planned",
    plannedRoute: "/academy/notifications",
  },
  {
    id: "accessibility",
    labelAr: "إمكانية الوصول",
    labelEn: "Accessibility",
    description: "Per-student accessibility preferences (motion, contrast, TTS rate, font scale).",
    status: "planned",
    plannedRoute: "/academy/accessibility",
  },
];
