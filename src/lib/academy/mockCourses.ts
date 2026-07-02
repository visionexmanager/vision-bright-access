/**
 * Academy — Sample Course Data (Phase 3, temporary)
 *
 * This file is NOT backed by Supabase. It exists so the Course Catalog,
 * Course Detail page, and Learning Player have real content to render
 * against while src/services/academy/lms.ts is still stubbed out (see that
 * file's header comment). Every course/lesson here is clearly fictional
 * sample content — no real instructor, video, or YouTube content is implied.
 *
 * When the real backend lands: delete this file, point the pages at
 * src/services/academy/lms.ts instead, and the component props (typed
 * against src/lib/types/academy-modules.ts + academy-lms.ts) stay identical.
 */

import type {
  AcademyCourseRow,
  AcademyCourseModuleRow,
  AcademyInstructorRow,
} from "@/lib/types/academy-modules";
import type {
  AcademyLessonRow,
  AcademyCourseReviewRow,
  AcademyLearningTrackRow,
} from "@/lib/types/academy-lms";

const now = new Date().toISOString();

export const MOCK_INSTRUCTORS: AcademyInstructorRow[] = [
  {
    id: "instructor-visionex-team",
    user_id: null,
    name: "فريق Visionex الأكاديمي",
    headline: "فريق إنتاج المحتوى الرسمي لأكاديمية Visionex",
    bio: "فريق من المدرّسين والمهندسين يصمم دورات Visionex الأصلية.",
    avatar_url: null,
    subjects: ["برمجة", "علوم بيانات"],
    rating: 4.8,
    verified: true,
    social_links: { website: "https://visionex.app" },
    skills: ["Python", "JavaScript", "Product Education"],
    courses_count: 2,
    students_count: 0,
    created_at: now,
    cover_image_url: null,
    expertise: ["هندسة برمجيات", "تصميم مناهج تعليمية"],
    languages: ["العربية", "English"],
    country: "لبنان",
    certifications: [],
    portfolio_url: null,
    level: "master",
    organization_id: "org-visionex",
  },
  {
    id: "instructor-sara-ahmad",
    user_id: null,
    name: "سارة الأحمد",
    headline: "مطوّرة تطبيقات موبايل بخبرة 8 سنوات",
    bio: "مدرّبة مستقلة في سوق المدرّسين، متخصصة في Flutter وتطوير التطبيقات متعددة المنصات.",
    avatar_url: null,
    subjects: ["تطوير تطبيقات"],
    rating: 4.9,
    verified: true,
    social_links: { linkedin: "https://linkedin.com", youtube: "https://youtube.com" },
    skills: ["Flutter", "Dart", "Firebase"],
    courses_count: 1,
    students_count: 0,
    created_at: now,
    cover_image_url: null,
    expertise: ["تطوير تطبيقات موبايل", "Firebase"],
    languages: ["العربية", "English"],
    country: "مصر",
    certifications: ["Google Associate Android Developer"],
    portfolio_url: null,
    level: "expert",
    organization_id: null,
  },
  {
    id: "instructor-data-collective",
    user_id: null,
    name: "مبادرة تحليل البيانات",
    headline: "مجتمع مدرّسين متخصص في علم البيانات",
    bio: "مجموعة مدرّسين من سوق المدرّسين متخصصين بتحليل البيانات وذكاء الأعمال.",
    avatar_url: null,
    subjects: ["علم البيانات"],
    rating: 4.6,
    verified: false,
    social_links: {},
    skills: ["Python", "SQL", "Power BI"],
    courses_count: 1,
    students_count: 0,
    created_at: now,
    cover_image_url: null,
    expertise: ["تحليل بيانات", "ذكاء الأعمال"],
    languages: ["العربية"],
    country: "السعودية",
    certifications: [],
    portfolio_url: null,
    level: "rising",
    organization_id: null,
  },
];

export const MOCK_COURSES: AcademyCourseRow[] = [
  {
    id: "course-python-101",
    title: "أساسيات بايثون للمبتدئين",
    description: "دورة تأسيسية شاملة تأخذك من الصفر حتى بناء أول مشروع بايثون حقيقي.",
    level: "ثانوي / بكالوريا",
    subject: "برمجة",
    instructor_id: "instructor-visionex-team",
    cover_image_url: null,
    published: true,
    created_at: now,
    updated_at: now,
    status: "published",
    gallery_urls: [],
    source: "visionex",
    difficulty: "beginner",
    language: "العربية",
    trailer_video_url: null,
    youtube_video_id: null,
    category: "برمجة",
    tags: ["Python", "مبتدئين", "برمجة"],
    duration_minutes: 240,
    is_free: true,
    price_vx: null,
    rating_avg: 4.8,
    rating_count: 3,
    students_count: 128,
    learning_outcomes: [
      "فهم أساسيات لغة بايثون ومتغيراتها",
      "بناء برامج تفاعلية بسيطة",
      "التعامل مع الشروط والحلقات التكرارية",
      "إنشاء أول مشروع بايثون متكامل",
    ],
    requirements: ["جهاز حاسوب", "لا حاجة لخبرة برمجية سابقة"],
  },
  {
    id: "course-flutter-marketplace",
    title: "تطوير تطبيقات فلاتر من الصفر",
    description: "دورة عملية لبناء تطبيقات iOS و Android بلغة Dart وإطار Flutter.",
    level: "جامعي / دراسات",
    subject: "تطوير تطبيقات",
    instructor_id: "instructor-sara-ahmad",
    cover_image_url: null,
    published: true,
    created_at: now,
    updated_at: now,
    status: "published",
    gallery_urls: [],
    source: "marketplace",
    difficulty: "intermediate",
    language: "العربية",
    trailer_video_url: null,
    youtube_video_id: null,
    category: "تطوير تطبيقات",
    tags: ["Flutter", "Dart", "موبايل"],
    duration_minutes: 360,
    is_free: false,
    price_vx: 1200,
    rating_avg: 4.9,
    rating_count: 2,
    students_count: 64,
    learning_outcomes: [
      "بناء واجهات Flutter احترافية",
      "ربط التطبيق بقاعدة بيانات Firebase",
      "نشر التطبيق على المتاجر",
    ],
    requirements: ["أساسيات البرمجة", "معرفة بلغة كائنية التوجه تفضل"],
  },
  {
    id: "course-cybersecurity-youtube",
    title: "مقدمة في الأمن السيبراني",
    description: "سلسلة دروس تعليمية مجمّعة من محتوى يوتيوب تعليمي حول أساسيات الأمن السيبراني.",
    level: "ثانوي / بكالوريا",
    subject: "أمن سيبراني",
    instructor_id: "instructor-visionex-team",
    cover_image_url: null,
    published: true,
    created_at: now,
    updated_at: now,
    status: "published",
    gallery_urls: [],
    source: "youtube",
    difficulty: "beginner",
    language: "العربية",
    trailer_video_url: null,
    youtube_video_id: "SAMPLE_YT_PLAYLIST",
    category: "أمن سيبراني",
    tags: ["أمن سيبراني", "شبكات"],
    duration_minutes: 90,
    is_free: true,
    price_vx: null,
    rating_avg: 4.5,
    rating_count: 1,
    students_count: 41,
    learning_outcomes: ["فهم المفاهيم الأساسية للأمن السيبراني", "التعرف على أنواع الهجمات الشائعة"],
    requirements: ["لا حاجة لخبرة سابقة"],
  },
  {
    id: "course-javascript-visionex",
    title: "جافاسكريبت للويب الحديث",
    description: "دورة Visionex الأصلية لتعلم JavaScript وبناء صفحات ويب تفاعلية.",
    level: "ثانوي / بكالوريا",
    subject: "برمجة",
    instructor_id: "instructor-visionex-team",
    cover_image_url: null,
    published: true,
    created_at: now,
    updated_at: now,
    status: "published",
    gallery_urls: [],
    source: "visionex",
    difficulty: "beginner",
    language: "العربية",
    trailer_video_url: null,
    youtube_video_id: null,
    category: "برمجة",
    tags: ["JavaScript", "ويب"],
    duration_minutes: 180,
    is_free: true,
    price_vx: null,
    rating_avg: null,
    rating_count: 0,
    students_count: 12,
    learning_outcomes: ["فهم أساسيات JavaScript", "التعامل مع DOM", "بناء تطبيق ويب صغير"],
    requirements: ["معرفة أساسية بـ HTML/CSS"],
  },
  {
    id: "course-data-science-marketplace",
    title: "علم البيانات وتحليل الأعمال",
    description: "دورة متقدمة من سوق المدرّسين في تحليل البيانات واتخاذ القرار المبني على البيانات.",
    level: "جامعي / دراسات",
    subject: "علم البيانات",
    instructor_id: "instructor-data-collective",
    cover_image_url: null,
    published: true,
    created_at: now,
    updated_at: now,
    status: "published",
    gallery_urls: [],
    source: "marketplace",
    difficulty: "advanced",
    language: "العربية",
    trailer_video_url: null,
    youtube_video_id: null,
    category: "علم البيانات",
    tags: ["Python", "SQL", "تحليل بيانات"],
    duration_minutes: 420,
    is_free: false,
    price_vx: 1800,
    rating_avg: 4.6,
    rating_count: 1,
    students_count: 19,
    learning_outcomes: ["تحليل مجموعات بيانات حقيقية", "بناء لوحات معلومات تفاعلية"],
    requirements: ["أساسيات بايثون", "أساسيات الإحصاء"],
  },
  {
    id: "course-flutter-ai-generated",
    title: "مسار تعلّم Flutter المخصّص بالذكاء الاصطناعي",
    description: "مسار ديناميكي يُبنى تلقائياً حسب مستواك وأهدافك عند طلبه من منير.",
    level: "جامعي / دراسات",
    subject: "تطوير تطبيقات",
    instructor_id: "instructor-visionex-team",
    cover_image_url: null,
    published: false,
    created_at: now,
    updated_at: now,
    status: "draft",
    gallery_urls: [],
    source: "ai",
    difficulty: "beginner",
    language: "العربية",
    trailer_video_url: null,
    youtube_video_id: null,
    category: "تطوير تطبيقات",
    tags: ["Flutter", "AI"],
    duration_minutes: 0,
    is_free: true,
    price_vx: null,
    rating_avg: null,
    rating_count: 0,
    students_count: 0,
    learning_outcomes: [],
    requirements: [],
  },
];

export const MOCK_MODULES: AcademyCourseModuleRow[] = [
  { id: "mod-py-1", course_id: "course-python-101", title: "الانطلاقة: المتغيرات والمخرجات", order_index: 1, content_url: null },
  { id: "mod-py-2", course_id: "course-python-101", title: "التحكم في تدفق البرنامج", order_index: 2, content_url: null },
  { id: "mod-flutter-1", course_id: "course-flutter-marketplace", title: "بناء أول واجهة Flutter", order_index: 1, content_url: null },
  { id: "mod-cyber-1", course_id: "course-cybersecurity-youtube", title: "أساسيات الأمن السيبراني", order_index: 1, content_url: null },
  { id: "mod-js-1", course_id: "course-javascript-visionex", title: "مقدمة إلى JavaScript", order_index: 1, content_url: null },
  { id: "mod-ds-1", course_id: "course-data-science-marketplace", title: "تحليل البيانات الاستكشافي", order_index: 1, content_url: null },
];

const LESSON_DEFAULTS = { file_url: null, live_session_scheduled_at: null } as const;

export const MOCK_LESSONS: AcademyLessonRow[] = [
  // Python 101 — Module 1
  {
    id: "lesson-py-1-1", module_id: "mod-py-1", course_id: "course-python-101",
    title: "مقدمة ولماذا بايثون؟", kind: "video", order_index: 1, duration_seconds: 480,
    video_url: null, youtube_video_id: null, body_markdown: null, ...LESSON_DEFAULTS,
    attachments: [], external_links: [], code_snippets: [], is_preview: true,
  },
  {
    id: "lesson-py-1-2", module_id: "mod-py-1", course_id: "course-python-101",
    title: "المتغيرات وأنواع البيانات", kind: "text", order_index: 2, duration_seconds: 360,
    video_url: null, youtube_video_id: null, ...LESSON_DEFAULTS,
    body_markdown: "## المتغيرات في بايثون\n\nفي بايثون لا تحتاج لتحديد نوع المتغير صراحة:\n\n```python\nname = \"سارة\"\nage = 17\n```\n\nجرّب تعديل القيم في بيئة التطوير الخاصة بك.",
    attachments: [{ id: "att-py-1", label: "ملخص الدرس (PDF)", file_url: "#", file_size_bytes: 245000 }],
    external_links: [{ label: "توثيق بايثون الرسمي", url: "https://docs.python.org" }],
    code_snippets: [{ language: "python", code: "name = \"سارة\"\nage = 17\nprint(f\"{name} عمرها {age} سنة\")" }],
    is_preview: true,
  },
  {
    id: "lesson-py-1-3", module_id: "mod-py-1", course_id: "course-python-101",
    title: "اختبار قصير: المتغيرات", kind: "quiz", order_index: 3, duration_seconds: 300,
    video_url: null, youtube_video_id: null, body_markdown: null, ...LESSON_DEFAULTS,
    attachments: [], external_links: [], code_snippets: [], is_preview: false,
  },
  // Python 101 — Module 2
  {
    id: "lesson-py-2-1", module_id: "mod-py-2", course_id: "course-python-101",
    title: "الجمل الشرطية if/else", kind: "video", order_index: 1, duration_seconds: 540,
    video_url: null, youtube_video_id: null, body_markdown: null, ...LESSON_DEFAULTS,
    attachments: [], external_links: [], code_snippets: [], is_preview: false,
  },
  {
    id: "lesson-py-2-2", module_id: "mod-py-2", course_id: "course-python-101",
    title: "مشروع: حاسبة بسيطة", kind: "assignment", order_index: 2, duration_seconds: 900,
    video_url: null, youtube_video_id: null, body_markdown: null, ...LESSON_DEFAULTS,
    attachments: [], external_links: [], code_snippets: [], is_preview: false,
  },

  // Flutter marketplace
  {
    id: "lesson-flutter-1-1", module_id: "mod-flutter-1", course_id: "course-flutter-marketplace",
    title: "تثبيت بيئة Flutter", kind: "video", order_index: 1, duration_seconds: 600,
    video_url: null, youtube_video_id: null, body_markdown: null, ...LESSON_DEFAULTS,
    attachments: [], external_links: [], code_snippets: [], is_preview: true,
  },
  {
    id: "lesson-flutter-1-2", module_id: "mod-flutter-1", course_id: "course-flutter-marketplace",
    title: "بنية تطبيق Flutter", kind: "text", order_index: 2, duration_seconds: 420,
    video_url: null, youtube_video_id: null, ...LESSON_DEFAULTS,
    body_markdown: "## Widgets في Flutter\n\nكل شيء في Flutter هو **Widget** — من الأزرار إلى تخطيط الصفحة بأكمله.",
    attachments: [], external_links: [],
    code_snippets: [{ language: "dart", code: "class MyApp extends StatelessWidget {\n  @override\n  Widget build(BuildContext context) => MaterialApp(home: Text('أهلاً'));\n}" }],
    is_preview: false,
  },
  {
    id: "lesson-flutter-1-3", module_id: "mod-flutter-1", course_id: "course-flutter-marketplace",
    title: "مشروع: شاشة تسجيل دخول", kind: "project", order_index: 3, duration_seconds: 1200,
    video_url: null, youtube_video_id: null, body_markdown: null, ...LESSON_DEFAULTS,
    attachments: [], external_links: [], code_snippets: [], is_preview: false,
  },

  // Cybersecurity (YouTube-sourced)
  {
    id: "lesson-cyber-1-1", module_id: "mod-cyber-1", course_id: "course-cybersecurity-youtube",
    title: "ما هو الأمن السيبراني؟", kind: "youtube", order_index: 1, duration_seconds: 620,
    video_url: null, youtube_video_id: "SAMPLE_YT_ID_1", body_markdown: null, ...LESSON_DEFAULTS,
    attachments: [], external_links: [], code_snippets: [], is_preview: true,
  },
  {
    id: "lesson-cyber-1-2", module_id: "mod-cyber-1", course_id: "course-cybersecurity-youtube",
    title: "أنواع الهجمات الشائعة", kind: "youtube", order_index: 2, duration_seconds: 540,
    video_url: null, youtube_video_id: "SAMPLE_YT_ID_2", body_markdown: null, ...LESSON_DEFAULTS,
    attachments: [], external_links: [], code_snippets: [], is_preview: false,
  },

  // JavaScript
  {
    id: "lesson-js-1-1", module_id: "mod-js-1", course_id: "course-javascript-visionex",
    title: "أول سطر جافاسكريبت", kind: "video", order_index: 1, duration_seconds: 400,
    video_url: null, youtube_video_id: null, body_markdown: null, ...LESSON_DEFAULTS,
    attachments: [], external_links: [], code_snippets: [], is_preview: true,
  },
  {
    id: "lesson-js-1-2", module_id: "mod-js-1", course_id: "course-javascript-visionex",
    title: "التعامل مع DOM", kind: "text", order_index: 2, duration_seconds: 360,
    video_url: null, youtube_video_id: null, ...LESSON_DEFAULTS,
    body_markdown: "## DOM\n\n`document.querySelector` هي بوابتك للتعامل مع عناصر الصفحة.",
    attachments: [], external_links: [],
    code_snippets: [{ language: "javascript", code: "document.querySelector('button').addEventListener('click', () => alert('أهلاً'));" }],
    is_preview: false,
  },

  // Data Science
  {
    id: "lesson-ds-1-1", module_id: "mod-ds-1", course_id: "course-data-science-marketplace",
    title: "مقدمة إلى Pandas", kind: "video", order_index: 1, duration_seconds: 700,
    video_url: null, youtube_video_id: null, body_markdown: null, ...LESSON_DEFAULTS,
    attachments: [], external_links: [], code_snippets: [], is_preview: true,
  },
  {
    id: "lesson-ds-1-2", module_id: "mod-ds-1", course_id: "course-data-science-marketplace",
    title: "اختبار: تنظيف البيانات", kind: "quiz", order_index: 2, duration_seconds: 300,
    video_url: null, youtube_video_id: null, body_markdown: null, ...LESSON_DEFAULTS,
    attachments: [], external_links: [], code_snippets: [], is_preview: false,
  },
];

export const MOCK_REVIEWS: AcademyCourseReviewRow[] = [
  { id: "rev-1", user_id: "sample-user-1", course_id: "course-python-101", rating: 5, comment: "شرح واضح جداً وسهل التتبع، استفدت كتير!", created_at: now },
  { id: "rev-2", user_id: "sample-user-2", course_id: "course-python-101", rating: 5, comment: "أفضل دورة بايثون بالعربي جربتها.", created_at: now },
  { id: "rev-3", user_id: "sample-user-3", course_id: "course-python-101", rating: 4, comment: "ممتازة، بس بتمنى أمثلة أكتر عملية.", created_at: now },
  { id: "rev-4", user_id: "sample-user-4", course_id: "course-flutter-marketplace", rating: 5, comment: "سارة بتشرح بطريقة عملية 100%.", created_at: now },
];

export const MOCK_LEARNING_TRACKS: AcademyLearningTrackRow[] = [
  {
    id: "track-beginner-programmer",
    title: "مسار المبرمج المبتدئ",
    description: "ابدأ من الصفر وابنِ أساساً قوياً في البرمجة خلال دورتين متتاليتين.",
    difficulty: "beginner",
    course_ids: ["course-python-101", "course-javascript-visionex"],
    estimated_duration_minutes: 420,
    skills: ["Python", "JavaScript", "التفكير البرمجي"],
    certificate_id: null,
  },
  {
    id: "track-intermediate-mobile",
    title: "مسار مطوّر التطبيقات",
    description: "انتقل من الأساسيات إلى بناء تطبيقات موبايل حقيقية بـ Flutter.",
    difficulty: "intermediate",
    course_ids: ["course-flutter-marketplace"],
    estimated_duration_minutes: 360,
    skills: ["Flutter", "Dart"],
    certificate_id: null,
  },
  {
    id: "track-advanced-data",
    title: "مسار محلّل البيانات المتقدّم",
    description: "دورة متقدمة في تحليل البيانات لمن أنهى الأساسيات.",
    difficulty: "advanced",
    course_ids: ["course-data-science-marketplace"],
    estimated_duration_minutes: 420,
    skills: ["Python", "SQL", "تحليل بيانات"],
    certificate_id: null,
  },
];

// ── Lookup helpers (client-side, mirrors the future service contract) ───────

export function getCourseById(id: string): AcademyCourseRow | null {
  return MOCK_COURSES.find((c) => c.id === id) ?? null;
}

export function getInstructorById(id: string): AcademyInstructorRow | null {
  return MOCK_INSTRUCTORS.find((i) => i.id === id) ?? null;
}

export function getModulesForCourse(courseId: string): AcademyCourseModuleRow[] {
  return MOCK_MODULES.filter((m) => m.course_id === courseId).sort((a, b) => a.order_index - b.order_index);
}

export function getLessonsForModule(moduleId: string): AcademyLessonRow[] {
  return MOCK_LESSONS.filter((l) => l.module_id === moduleId).sort((a, b) => a.order_index - b.order_index);
}

export function getLessonById(id: string): AcademyLessonRow | null {
  return MOCK_LESSONS.find((l) => l.id === id) ?? null;
}

export function getLessonsForCourse(courseId: string): AcademyLessonRow[] {
  return MOCK_LESSONS
    .filter((l) => l.course_id === courseId)
    .sort((a, b) => a.order_index - b.order_index);
}

export function getReviewsForCourse(courseId: string): AcademyCourseReviewRow[] {
  return MOCK_REVIEWS.filter((r) => r.course_id === courseId);
}

export function getCoursesByInstructor(instructorId: string): AcademyCourseRow[] {
  return MOCK_COURSES.filter((c) => c.instructor_id === instructorId);
}

export function getSimilarCourses(courseId: string, limit = 4): AcademyCourseRow[] {
  const course = getCourseById(courseId);
  if (!course) return [];
  return MOCK_COURSES
    .filter((c) => c.id !== courseId && (c.category === course.category || c.subject === course.subject))
    .slice(0, limit);
}

export interface MockCourseFilters {
  query?: string;
  category?: string;
  difficulty?: string;
  source?: string;
  sort?: "featured" | "popular" | "new";
}

export function searchCourses(filters: MockCourseFilters = {}): AcademyCourseRow[] {
  let results = MOCK_COURSES.filter((c) => c.published);

  if (filters.query?.trim()) {
    const q = filters.query.trim().toLowerCase();
    results = results.filter((c) =>
      c.title.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.tags.some((t) => t.toLowerCase().includes(q))
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

export function getAllCategories(): string[] {
  return Array.from(new Set(MOCK_COURSES.map((c) => c.category)));
}

export function getLearningTracks(): AcademyLearningTrackRow[] {
  return MOCK_LEARNING_TRACKS;
}

export function getLearningTrackById(id: string): AcademyLearningTrackRow | null {
  return MOCK_LEARNING_TRACKS.find((t) => t.id === id) ?? null;
}
