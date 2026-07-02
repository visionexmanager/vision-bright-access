/**
 * Academy — Sample Assessment Content (Phase 6, temporary)
 *
 * Same status as mockCourses.ts (Phase 3): fleshes out the quiz/assignment/
 * project LESSONS that mockCourses.ts already seeded with
 * kind === "quiz"/"assignment"/"project" but left contentless, so the new
 * Phase 6 engine has something real to demonstrate against existing sample
 * courses. No NEW courses/lessons are introduced here — only detail records
 * for lessons Phase 3 already created.
 */

import type { AcademyQuizRow, AcademyQuizQuestionRow, AcademyAssignmentRow, AcademyProjectRow } from "@/lib/types/academy-lms";

export const MOCK_QUIZZES: Record<string, { quiz: AcademyQuizRow; questions: AcademyQuizQuestionRow[] }> = {
  "lesson-py-1-3": {
    quiz: {
      id: "quiz-py-1-3", lesson_id: "lesson-py-1-3", title: "اختبار قصير: المتغيرات",
      passing_score_percent: 70, time_limit_minutes: 5, scope: "lesson", attempts_limit: 3,
      randomize_questions: false, instant_feedback: true,
    },
    questions: [
      {
        id: "q-py-1", quiz_id: "quiz-py-1-3", order_index: 1, type: "single_choice",
        prompt: "ما الناتج من: print(type(5))؟",
        choices: ["<class 'int'>", "<class 'str'>", "<class 'float'>", "<class 'bool'>"],
        correct_choice_indexes: [0], accepted_answers: [], code_starter: null, code_language: null,
        points: 10, difficulty: "easy", explanation: "الرقم 5 بدون فاصلة عشرية هو من نوع int في بايثون.",
      },
      {
        id: "q-py-2", quiz_id: "quiz-py-1-3", order_index: 2, type: "true_false",
        prompt: "في بايثون، يجب تحديد نوع المتغير صراحة قبل استخدامه.",
        choices: ["صح", "خطأ"], correct_choice_indexes: [1], accepted_answers: [], code_starter: null, code_language: null,
        points: 10, difficulty: "easy", explanation: "بايثون لغة ديناميكية النوع — لا حاجة لتحديد النوع صراحة.",
      },
      {
        id: "q-py-3", quiz_id: "quiz-py-1-3", order_index: 3, type: "short_answer",
        prompt: "ما الكلمة المفتاحية المستخدمة لتعريف دالة في بايثون؟",
        choices: [], correct_choice_indexes: [], accepted_answers: ["def"], code_starter: null, code_language: null,
        points: 10, difficulty: "medium", explanation: "تُستخدم الكلمة المفتاحية `def` لتعريف الدوال.",
      },
    ],
  },
  "lesson-ds-1-2": {
    quiz: {
      id: "quiz-ds-1-2", lesson_id: "lesson-ds-1-2", title: "اختبار: تنظيف البيانات",
      passing_score_percent: 70, time_limit_minutes: 8, scope: "lesson", attempts_limit: null,
      randomize_questions: true, instant_feedback: false,
    },
    questions: [
      {
        id: "q-ds-1", quiz_id: "quiz-ds-1-2", order_index: 1, type: "multiple_choice",
        prompt: "أي مما يلي من خطوات تنظيف البيانات الشائعة؟ (اختر كل ما ينطبق)",
        choices: ["إزالة القيم المكررة", "معالجة القيم المفقودة", "توحيد صيغ التاريخ", "زيادة عدد الأعمدة عشوائياً"],
        correct_choice_indexes: [0, 1, 2], accepted_answers: [], code_starter: null, code_language: null,
        points: 15, difficulty: "medium", explanation: "زيادة الأعمدة عشوائياً ليست جزءاً من التنظيف، بل قد تُدخل ضوضاء غير مرغوبة.",
      },
      {
        id: "q-ds-2", quiz_id: "quiz-ds-1-2", order_index: 2, type: "code",
        prompt: "اكتب سطر Pandas لحذف الصفوف التي تحتوي على قيم فارغة من DataFrame باسم df.",
        choices: [], correct_choice_indexes: [], accepted_answers: [], code_starter: "df = ", code_language: "python",
        points: 15, difficulty: "hard", explanation: "الإجابة النموذجية: df.dropna() — يتطلب مراجعة يدوية من المدرّس.",
      },
    ],
  },
};

export const MOCK_ASSIGNMENTS: Record<string, AcademyAssignmentRow> = {
  "lesson-py-2-2": {
    id: "assignment-py-2-2", lesson_id: "lesson-py-2-2", title: "مشروع: حاسبة بسيطة",
    instructions_markdown: "اكتب برنامج بايثون بسيط يطلب رقمين من المستخدم وعملية حسابية (جمع/طرح/ضرب/قسمة)، ثم يطبع الناتج.\n\nارفع كود المشروع كملف `.py` أو الصق الكود مباشرة في حقل الملاحظات.",
    max_score: 100, due_offset_days: 14,
    type: "coding", rubric: [
      { criterion: "يعمل البرنامج بدون أخطاء", max_points: 40 },
      { criterion: "يدعم العمليات الأربع الأساسية", max_points: 40 },
      { criterion: "وضوح الكود وتعليقاته", max_points: 20 },
    ],
    allow_resubmission: true, ai_feedback_enabled: false,
  },
};

export const MOCK_PROJECTS: Record<string, AcademyProjectRow> = {
  "lesson-flutter-1-3": {
    id: "project-flutter-1-3", lesson_id: "lesson-flutter-1-3", title: "مشروع: شاشة تسجيل دخول",
    brief_markdown: "صمّم شاشة تسجيل دخول كاملة بتطبيق Flutter تحاكي تطبيقاً حقيقياً.",
    rubric: [
      { criterion: "تصميم الواجهة ومطابقتها لمبادئ Material", max_points: 30 },
      { criterion: "التحقق من صحة المدخلات", max_points: 30 },
      { criterion: "بنية الكود وتنظيم الـ Widgets", max_points: 25 },
      { criterion: "التوافق مع أحجام الشاشات المختلفة", max_points: 15 },
    ],
    description: "طبّق ما تعلّمته عن Widgets وبنية تطبيق Flutter ببناء شاشة تسجيل دخول جاهزة للاستخدام في تطبيق حقيقي.",
    requirements: [
      "حقل بريد إلكتروني مع تحقق من الصيغة",
      "حقل كلمة مرور مع خيار إظهار/إخفاء",
      "زر تسجيل دخول مع حالة تحميل",
      "رابط \"نسيت كلمة المرور؟\"",
    ],
    steps: [
      "أنشئ مشروع Flutter جديد",
      "صمم الواجهة باستخدام Column وTextFormField",
      "أضف منطق التحقق من صحة الحقول",
      "اربط زر الدخول بحالة تحميل مؤقتة (بدون باك-إند فعلي)",
    ],
    resources: [
      { label: "توثيق TextFormField الرسمي", url: "https://api.flutter.dev/flutter/material/TextFormField-class.html" },
    ],
    submission_method: "repo_url",
    ai_review_enabled: false,
  },
};
