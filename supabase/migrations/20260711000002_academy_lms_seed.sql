-- ============================================================
-- Seed: move the 6 sample courses from src/lib/academy/mockCourses.ts
-- into real rows, so the catalog isn't empty right after this migration
-- and the "sample content" becomes genuinely persisted/editable.
--
-- Fixed literal UUIDs (not gen_random_uuid()) so course/module/lesson rows
-- can reference each other within this file. All INSERTs are
-- ON CONFLICT (id) DO NOTHING, so re-running this migration is a no-op.
--
-- Note: the 4 sample reviews in mockCourses.ts (MOCK_REVIEWS) are NOT
-- seeded as academy_course_reviews rows — their fake user ids don't map to
-- real auth.users rows and academy_course_reviews.user_id is a real FK.
-- Each course's rating_avg/rating_count columns already carry the same
-- aggregate numbers directly, so the catalog display is unaffected.
-- ============================================================

-- ── Instructors ────────────────────────────────────────────────────────────

INSERT INTO public.academy_instructors
  (id, user_id, name, headline, bio, subjects, rating, verified, social_links, skills,
   courses_count, students_count, expertise, languages, country, level)
VALUES
  ('a1000000-0000-4000-8000-000000000001', NULL,
   'فريق Visionex الأكاديمي', 'فريق إنتاج المحتوى الرسمي لأكاديمية Visionex',
   'فريق من المدرّسين والمهندسين يصمم دورات Visionex الأصلية.',
   ARRAY['برمجة','علوم بيانات'], 4.8, true, '{"website":"https://visionex.app"}'::jsonb,
   ARRAY['Python','JavaScript','Product Education'], 3, 0,
   ARRAY['هندسة برمجيات','تصميم مناهج تعليمية'], ARRAY['العربية','English'], 'لبنان', 'master'),
  ('a1000000-0000-4000-8000-000000000002', NULL,
   'سارة الأحمد', 'مطوّرة تطبيقات موبايل بخبرة 8 سنوات',
   'مدرّبة مستقلة في سوق المدرّسين، متخصصة في Flutter وتطوير التطبيقات متعددة المنصات.',
   ARRAY['تطوير تطبيقات'], 4.9, true, '{"linkedin":"https://linkedin.com","youtube":"https://youtube.com"}'::jsonb,
   ARRAY['Flutter','Dart','Firebase'], 1, 0,
   ARRAY['تطوير تطبيقات موبايل','Firebase'], ARRAY['العربية','English'], 'مصر', 'expert'),
  ('a1000000-0000-4000-8000-000000000003', NULL,
   'مبادرة تحليل البيانات', 'مجتمع مدرّسين متخصص في علم البيانات',
   'مجموعة مدرّسين من سوق المدرّسين متخصصين بتحليل البيانات وذكاء الأعمال.',
   ARRAY['علم البيانات'], 4.6, false, '{}'::jsonb,
   ARRAY['Python','SQL','Power BI'], 1, 0,
   ARRAY['تحليل بيانات','ذكاء الأعمال'], ARRAY['العربية'], 'السعودية', 'rising')
ON CONFLICT (id) DO NOTHING;

-- ── Courses ──────────────────────────────────────────────────────────────

INSERT INTO public.academy_courses
  (id, title, description, level, subject, instructor_id, published, status, source, difficulty,
   language, category, tags, duration_minutes, is_free, price_vx, rating_avg, rating_count,
   students_count, learning_outcomes, requirements, youtube_video_id)
VALUES
  ('c1000000-0000-4000-8000-000000000001',
   'أساسيات بايثون للمبتدئين', 'دورة تأسيسية شاملة تأخذك من الصفر حتى بناء أول مشروع بايثون حقيقي.',
   'ثانوي / بكالوريا', 'برمجة', 'a1000000-0000-4000-8000-000000000001', true, 'published',
   'visionex', 'beginner', 'العربية', 'برمجة', ARRAY['Python','مبتدئين','برمجة'], 240, true, NULL,
   4.8, 3, 128,
   ARRAY['فهم أساسيات لغة بايثون ومتغيراتها','بناء برامج تفاعلية بسيطة','التعامل مع الشروط والحلقات التكرارية','إنشاء أول مشروع بايثون متكامل'],
   ARRAY['جهاز حاسوب','لا حاجة لخبرة برمجية سابقة'], NULL),
  ('c1000000-0000-4000-8000-000000000002',
   'تطوير تطبيقات فلاتر من الصفر', 'دورة عملية لبناء تطبيقات iOS و Android بلغة Dart وإطار Flutter.',
   'جامعي / دراسات', 'تطوير تطبيقات', 'a1000000-0000-4000-8000-000000000002', true, 'published',
   'marketplace', 'intermediate', 'العربية', 'تطوير تطبيقات', ARRAY['Flutter','Dart','موبايل'], 360, false, 1200,
   4.9, 2, 64,
   ARRAY['بناء واجهات Flutter احترافية','ربط التطبيق بقاعدة بيانات Firebase','نشر التطبيق على المتاجر'],
   ARRAY['أساسيات البرمجة','معرفة بلغة كائنية التوجه تفضل'], NULL),
  ('c1000000-0000-4000-8000-000000000003',
   'مقدمة في الأمن السيبراني', 'سلسلة دروس تعليمية مجمّعة من محتوى يوتيوب تعليمي حول أساسيات الأمن السيبراني.',
   'ثانوي / بكالوريا', 'أمن سيبراني', 'a1000000-0000-4000-8000-000000000001', true, 'published',
   'youtube', 'beginner', 'العربية', 'أمن سيبراني', ARRAY['أمن سيبراني','شبكات'], 90, true, NULL,
   4.5, 1, 41,
   ARRAY['فهم المفاهيم الأساسية للأمن السيبراني','التعرف على أنواع الهجمات الشائعة'],
   ARRAY['لا حاجة لخبرة سابقة'], 'SAMPLE_YT_PLAYLIST'),
  ('c1000000-0000-4000-8000-000000000004',
   'جافاسكريبت للويب الحديث', 'دورة Visionex الأصلية لتعلم JavaScript وبناء صفحات ويب تفاعلية.',
   'ثانوي / بكالوريا', 'برمجة', 'a1000000-0000-4000-8000-000000000001', true, 'published',
   'visionex', 'beginner', 'العربية', 'برمجة', ARRAY['JavaScript','ويب'], 180, true, NULL,
   NULL, 0, 12,
   ARRAY['فهم أساسيات JavaScript','التعامل مع DOM','بناء تطبيق ويب صغير'],
   ARRAY['معرفة أساسية بـ HTML/CSS'], NULL),
  ('c1000000-0000-4000-8000-000000000005',
   'علم البيانات وتحليل الأعمال', 'دورة متقدمة من سوق المدرّسين في تحليل البيانات واتخاذ القرار المبني على البيانات.',
   'جامعي / دراسات', 'علم البيانات', 'a1000000-0000-4000-8000-000000000003', true, 'published',
   'marketplace', 'advanced', 'العربية', 'علم البيانات', ARRAY['Python','SQL','تحليل بيانات'], 420, false, 1800,
   4.6, 1, 19,
   ARRAY['تحليل مجموعات بيانات حقيقية','بناء لوحات معلومات تفاعلية'],
   ARRAY['أساسيات بايثون','أساسيات الإحصاء'], NULL),
  ('c1000000-0000-4000-8000-000000000006',
   'مسار تعلّم Flutter المخصّص بالذكاء الاصطناعي', 'مسار ديناميكي يُبنى تلقائياً حسب مستواك وأهدافك عند طلبه من منير.',
   'جامعي / دراسات', 'تطوير تطبيقات', 'a1000000-0000-4000-8000-000000000001', false, 'draft',
   'ai', 'beginner', 'العربية', 'تطوير تطبيقات', ARRAY['Flutter','AI'], 0, true, NULL,
   NULL, 0, 0, ARRAY[]::text[], ARRAY[]::text[], NULL)
ON CONFLICT (id) DO NOTHING;

-- ── Modules ──────────────────────────────────────────────────────────────

INSERT INTO public.academy_course_modules (id, course_id, title, order_index) VALUES
  ('d1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'الانطلاقة: المتغيرات والمخرجات', 1),
  ('d1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001', 'التحكم في تدفق البرنامج', 2),
  ('d1000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000002', 'بناء أول واجهة Flutter', 1),
  ('d1000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000003', 'أساسيات الأمن السيبراني', 1),
  ('d1000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000004', 'مقدمة إلى JavaScript', 1),
  ('d1000000-0000-4000-8000-000000000006', 'c1000000-0000-4000-8000-000000000005', 'تحليل البيانات الاستكشافي', 1)
ON CONFLICT (id) DO NOTHING;

-- ── Lessons ──────────────────────────────────────────────────────────────

INSERT INTO public.academy_lessons
  (id, module_id, course_id, title, kind, order_index, duration_seconds,
   youtube_video_id, body_markdown, attachments, external_links, code_snippets, is_preview)
VALUES
  ('e1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001',
   'مقدمة ولماذا بايثون؟', 'video', 1, 480, NULL, NULL, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, true),
  ('e1000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001',
   'المتغيرات وأنواع البيانات', 'text', 2, 360, NULL,
   '## المتغيرات في بايثون

في بايثون لا تحتاج لتحديد نوع المتغير صراحة:

```python
name = "سارة"
age = 17
```

جرّب تعديل القيم في بيئة التطوير الخاصة بك.',
   '[{"id":"att-py-1","label":"ملخص الدرس (PDF)","file_url":"#","file_size_bytes":245000}]'::jsonb,
   '[{"label":"توثيق بايثون الرسمي","url":"https://docs.python.org"}]'::jsonb,
   '[{"language":"python","code":"name = \"سارة\"\nage = 17\nprint(f\"{name} عمرها {age} سنة\")"}]'::jsonb,
   true),
  ('e1000000-0000-4000-8000-000000000003', 'd1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001',
   'اختبار قصير: المتغيرات', 'quiz', 3, 300, NULL, NULL, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, false),
  ('e1000000-0000-4000-8000-000000000004', 'd1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001',
   'الجمل الشرطية if/else', 'video', 1, 540, NULL, NULL, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, false),
  ('e1000000-0000-4000-8000-000000000005', 'd1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001',
   'مشروع: حاسبة بسيطة', 'assignment', 2, 900, NULL, NULL, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, false),

  ('e1000000-0000-4000-8000-000000000006', 'd1000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000002',
   'تثبيت بيئة Flutter', 'video', 1, 600, NULL, NULL, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, true),
  ('e1000000-0000-4000-8000-000000000007', 'd1000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000002',
   'بنية تطبيق Flutter', 'text', 2, 420, NULL,
   '## Widgets في Flutter

كل شيء في Flutter هو **Widget** — من الأزرار إلى تخطيط الصفحة بأكمله.',
   '[]'::jsonb, '[]'::jsonb,
   '[{"language":"dart","code":"class MyApp extends StatelessWidget {\n  @override\n  Widget build(BuildContext context) => MaterialApp(home: Text(''أهلاً''));\n}"}]'::jsonb,
   false),
  ('e1000000-0000-4000-8000-000000000008', 'd1000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000002',
   'مشروع: شاشة تسجيل دخول', 'project', 3, 1200, NULL, NULL, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, false),

  ('e1000000-0000-4000-8000-000000000009', 'd1000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000003',
   'ما هو الأمن السيبراني؟', 'youtube', 1, 620, 'SAMPLE_YT_ID_1', NULL, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, true),
  ('e1000000-0000-4000-8000-000000000010', 'd1000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000003',
   'أنواع الهجمات الشائعة', 'youtube', 2, 540, 'SAMPLE_YT_ID_2', NULL, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, false),

  ('e1000000-0000-4000-8000-000000000011', 'd1000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000004',
   'أول سطر جافاسكريبت', 'video', 1, 400, NULL, NULL, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, true),
  ('e1000000-0000-4000-8000-000000000012', 'd1000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000004',
   'التعامل مع DOM', 'text', 2, 360, NULL,
   '## DOM

`document.querySelector` هي بوابتك للتعامل مع عناصر الصفحة.',
   '[]'::jsonb, '[]'::jsonb,
   '[{"language":"javascript","code":"document.querySelector(''button'').addEventListener(''click'', () => alert(''أهلاً''));"}]'::jsonb,
   false),

  ('e1000000-0000-4000-8000-000000000013', 'd1000000-0000-4000-8000-000000000006', 'c1000000-0000-4000-8000-000000000005',
   'مقدمة إلى Pandas', 'video', 1, 700, NULL, NULL, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, true),
  ('e1000000-0000-4000-8000-000000000014', 'd1000000-0000-4000-8000-000000000006', 'c1000000-0000-4000-8000-000000000005',
   'اختبار: تنظيف البيانات', 'quiz', 2, 300, NULL, NULL, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, false)
ON CONFLICT (id) DO NOTHING;

-- ── Learning tracks ──────────────────────────────────────────────────────

INSERT INTO public.academy_learning_tracks
  (id, title, description, difficulty, course_ids, estimated_duration_minutes, skills)
VALUES
  ('91000000-0000-4000-8000-000000000001', 'مسار المبرمج المبتدئ',
   'ابدأ من الصفر وابنِ أساساً قوياً في البرمجة خلال دورتين متتاليتين.', 'beginner',
   ARRAY['c1000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000004']::uuid[],
   420, ARRAY['Python','JavaScript','التفكير البرمجي']),
  ('91000000-0000-4000-8000-000000000002', 'مسار مطوّر التطبيقات',
   'انتقل من الأساسيات إلى بناء تطبيقات موبايل حقيقية بـ Flutter.', 'intermediate',
   ARRAY['c1000000-0000-4000-8000-000000000002']::uuid[],
   360, ARRAY['Flutter','Dart']),
  ('91000000-0000-4000-8000-000000000003', 'مسار محلّل البيانات المتقدّم',
   'دورة متقدمة في تحليل البيانات لمن أنهى الأساسيات.', 'advanced',
   ARRAY['c1000000-0000-4000-8000-000000000005']::uuid[],
   420, ARRAY['Python','SQL','تحليل بيانات'])
ON CONFLICT (id) DO NOTHING;
