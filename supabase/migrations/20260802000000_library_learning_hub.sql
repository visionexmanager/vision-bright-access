-- ============================================================================
-- Learning Hub: transforms Library books into interactive learning experiences
-- integrated with Visionex Academy. Sections:
--   1. Learning Paths (+ prerequisites, enrollments, adaptive progress)
--   2. Book-to-Course conversion
--   3. Smart Notes enhancements (notebooks, voice/image, pinning, tags, search)
--   4. Highlights enhancements (favorites, search)
--   5. Flashcards (decks, SM-2 spaced repetition, study sessions)
--   6. Quizzes (structured multi-type questions, timed exams, attempts)
--   7. Certificates
--   8. Group Learning (study groups on top of existing clubs, shared notes,
--      assignments, peer review, teacher feedback)
--   9. Academy Integration (course<->book links, instructor recommendations,
--      progress sync)
--  10. Achievements + XP branches
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- 1. LEARNING PATHS
-- ============================================================================

-- public.library_learning_paths already exists (Global Digital Library
-- phase, 20260730000000) as a simple admin-curated ordered-book-list table
-- (title, slug, description, cover_image_url, created_by, is_published) with
-- zero live callers today (no service/hook/page ever consumed it). We widen
-- it in place rather than creating a competing table, and supersede its
-- companion library_learning_path_books (also never consumed) with the
-- richer, polymorphic library_learning_path_items below.

DO $$ BEGIN
  CREATE TYPE public.library_learning_path_level AS ENUM
    ('beginner', 'intermediate', 'advanced', 'professional', 'certification', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.library_learning_paths
  ADD COLUMN IF NOT EXISTS level public.library_learning_path_level NOT NULL DEFAULT 'beginner',
  ADD COLUMN IF NOT EXISTS is_adaptive BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_certification_track BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.is_library_learning_path_owner(_path_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.library_learning_paths
    WHERE id = _path_id AND created_by = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.is_library_academy_instructor()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.academy_instructors WHERE user_id = auth.uid())
$$;

-- Existing policies ("public read published", "admin manages") stay as-is;
-- this adds instructor-authored paths on top of the admin-only original.
CREATE POLICY "library_learning_paths: creators manage own"
  ON public.library_learning_paths FOR ALL
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid() AND (public.is_library_academy_instructor() OR public.has_role(auth.uid(), 'admin')));

-- library_learning_path_books (path_id, book_id, order_index, note) had no
-- live callers — replaced by the polymorphic item table below, which also
-- supports academy_course and quiz items, not just books.
DROP TABLE IF EXISTS public.library_learning_path_books;

CREATE TABLE IF NOT EXISTS public.library_learning_path_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id UUID NOT NULL REFERENCES public.library_learning_paths(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('book', 'academy_course', 'quiz')),
  book_id UUID REFERENCES public.library_books(id) ON DELETE CASCADE,
  academy_course_id UUID REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  quiz_id UUID, -- FK added after library_quizzes exists (section 6)
  title_override TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT true,
  estimated_minutes INTEGER,
  is_remedial BOOLEAN NOT NULL DEFAULT false,
  remedial_for_item_id UUID REFERENCES public.library_learning_path_items(id) ON DELETE SET NULL,
  remedial_threshold_percent INTEGER NOT NULL DEFAULT 70,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_library_learning_path_items_path
  ON public.library_learning_path_items(path_id, order_index);

ALTER TABLE public.library_learning_path_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_learning_path_items: read if path visible"
  ON public.library_learning_path_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.library_learning_paths p
      WHERE p.id = path_id
        AND (p.is_published OR p.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "library_learning_path_items: owner manages"
  ON public.library_learning_path_items FOR ALL
  USING (public.is_library_learning_path_owner(path_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_library_learning_path_owner(path_id) OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.library_learning_path_prerequisites (
  path_id UUID NOT NULL REFERENCES public.library_learning_paths(id) ON DELETE CASCADE,
  prerequisite_path_id UUID NOT NULL REFERENCES public.library_learning_paths(id) ON DELETE CASCADE,
  PRIMARY KEY (path_id, prerequisite_path_id),
  CHECK (path_id <> prerequisite_path_id)
);

ALTER TABLE public.library_learning_path_prerequisites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_learning_path_prerequisites: public read"
  ON public.library_learning_path_prerequisites FOR SELECT USING (true);

CREATE POLICY "library_learning_path_prerequisites: owner manages"
  ON public.library_learning_path_prerequisites FOR ALL
  USING (public.is_library_learning_path_owner(path_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_library_learning_path_owner(path_id) OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.library_learning_path_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  path_id UUID NOT NULL REFERENCES public.library_learning_paths(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  progress_percent NUMERIC NOT NULL DEFAULT 0,
  UNIQUE (user_id, path_id)
);

ALTER TABLE public.library_learning_path_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_learning_path_enrollments: user manages own"
  ON public.library_learning_path_enrollments FOR ALL
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.library_learning_path_item_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.library_learning_path_items(id) ON DELETE CASCADE,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  score_percent NUMERIC,
  PRIMARY KEY (user_id, item_id)
);

ALTER TABLE public.library_learning_path_item_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_learning_path_item_progress: user manages own"
  ON public.library_learning_path_item_progress FOR ALL
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.enroll_in_library_learning_path(_path_id UUID)
RETURNS public.library_learning_path_enrollments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _row public.library_learning_path_enrollments;
  _missing_prereq TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;

  SELECT p.title INTO _missing_prereq
  FROM public.library_learning_path_prerequisites req
  JOIN public.library_learning_paths p ON p.id = req.prerequisite_path_id
  WHERE req.path_id = _path_id
    AND NOT EXISTS (
      SELECT 1 FROM public.library_learning_path_enrollments e
      WHERE e.path_id = req.prerequisite_path_id AND e.user_id = auth.uid() AND e.completed_at IS NOT NULL
    )
  LIMIT 1;

  IF _missing_prereq IS NOT NULL THEN
    RAISE EXCEPTION 'Prerequisite not completed: %', _missing_prereq;
  END IF;

  INSERT INTO public.library_learning_path_enrollments (user_id, path_id)
  VALUES (auth.uid(), _path_id)
  ON CONFLICT (user_id, path_id) DO NOTHING
  RETURNING * INTO _row;

  IF _row.id IS NULL THEN
    SELECT * INTO _row FROM public.library_learning_path_enrollments
    WHERE user_id = auth.uid() AND path_id = _path_id;
  END IF;

  RETURN _row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enroll_in_library_learning_path(UUID) TO authenticated;

-- Sequential unlock + adaptive remedial-skip computation, one row per item.
CREATE OR REPLACE FUNCTION public.get_library_learning_path_progress(_path_id UUID)
RETURNS TABLE (
  item_id UUID, item_type TEXT, title TEXT, order_index INTEGER,
  is_required BOOLEAN, is_remedial BOOLEAN, is_skipped BOOLEAN, is_unlocked BOOLEAN,
  completed BOOLEAN, completed_at TIMESTAMPTZ, score_percent NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user UUID := auth.uid();
  _item RECORD;
  _prior_ok BOOLEAN := true;
  _skipped BOOLEAN;
  _unlocked BOOLEAN;
  _done BOOLEAN;
  _done_at TIMESTAMPTZ;
  _score NUMERIC;
BEGIN
  FOR _item IN
    SELECT i.id, i.item_type, COALESCE(i.title_override,
             COALESCE(b.title, c.title, q.title, 'Untitled item')) AS resolved_title,
           i.order_index, i.is_required, i.is_remedial, i.remedial_for_item_id, i.remedial_threshold_percent
    FROM public.library_learning_path_items i
    LEFT JOIN public.library_books b ON b.id = i.book_id
    LEFT JOIN public.academy_courses c ON c.id = i.academy_course_id
    LEFT JOIN public.library_quizzes q ON q.id = i.quiz_id
    WHERE i.path_id = _path_id
    ORDER BY i.order_index ASC
  LOOP
    _skipped := false;
    IF _item.is_remedial AND _item.remedial_for_item_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.library_learning_path_items ref
        JOIN public.library_quiz_attempts qa ON qa.quiz_id = ref.quiz_id AND qa.user_id = _user
        WHERE ref.id = _item.remedial_for_item_id
          AND qa.score_percent >= _item.remedial_threshold_percent
      ) INTO _skipped;
    END IF;

    SELECT p.completed, p.completed_at, p.score_percent
      INTO _done, _done_at, _score
    FROM public.library_learning_path_item_progress p
    WHERE p.item_id = _item.id AND p.user_id = _user;

    _unlocked := (NOT _skipped) AND _prior_ok;

    item_id := _item.id; item_type := _item.item_type; title := _item.resolved_title;
    order_index := _item.order_index; is_required := _item.is_required; is_remedial := _item.is_remedial;
    is_skipped := _skipped; is_unlocked := _unlocked;
    completed := COALESCE(_done, false); completed_at := _done_at; score_percent := _score;
    RETURN NEXT;

    IF (NOT _item.is_required) OR _skipped THEN
      -- optional or skipped items never block progression
      NULL;
    ELSE
      _prior_ok := _prior_ok AND COALESCE(_done, false);
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_library_learning_path_progress(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_library_learning_path_item(_item_id UUID, _score_percent NUMERIC DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user UUID := auth.uid();
  _path_id UUID;
  _total INTEGER;
  _completed INTEGER;
  _all_done BOOLEAN;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;

  SELECT path_id INTO _path_id FROM public.library_learning_path_items WHERE id = _item_id;
  IF _path_id IS NULL THEN RAISE EXCEPTION 'Item not found'; END IF;

  INSERT INTO public.library_learning_path_item_progress (user_id, item_id, completed, completed_at, score_percent)
  VALUES (_user, _item_id, true, now(), _score_percent)
  ON CONFLICT (user_id, item_id) DO UPDATE
    SET completed = true, completed_at = now(), score_percent = EXCLUDED.score_percent;

  SELECT count(*) FILTER (WHERE i.is_required), count(*) FILTER (WHERE i.is_required AND p.completed)
    INTO _total, _completed
  FROM public.library_learning_path_items i
  LEFT JOIN public.library_learning_path_item_progress p ON p.item_id = i.id AND p.user_id = _user
  WHERE i.path_id = _path_id;

  _all_done := _total > 0 AND _completed = _total;

  UPDATE public.library_learning_path_enrollments
  SET progress_percent = CASE WHEN _total > 0 THEN round(_completed::NUMERIC / _total * 100, 1) ELSE 0 END,
      completed_at = CASE WHEN _all_done THEN COALESCE(completed_at, now()) ELSE completed_at END
  WHERE path_id = _path_id AND user_id = _user;

  IF _all_done THEN
    PERFORM public.award_library_xp(200, 'Learning path completed:' || _path_id::text);
    PERFORM public.check_and_award_library_achievement(_user, 'learning_path_completed');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_library_learning_path_item(UUID, NUMERIC) TO authenticated;

-- ============================================================================
-- 2. BOOK TO COURSE
-- ============================================================================

ALTER TABLE public.academy_courses DROP CONSTRAINT IF EXISTS academy_courses_source_check;
ALTER TABLE public.academy_courses ADD CONSTRAINT academy_courses_source_check
  CHECK (source IN ('visionex', 'marketplace', 'youtube', 'ai', 'library_book'));

CREATE TABLE IF NOT EXISTS public.library_book_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL UNIQUE REFERENCES public.library_books(id) ON DELETE CASCADE,
  academy_course_id UUID NOT NULL UNIQUE REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_book_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_book_courses: public read"
  ON public.library_book_courses FOR SELECT USING (true);

CREATE POLICY "library_book_courses: book editor manages"
  ON public.library_book_courses FOR ALL
  USING (public.can_edit_library_book(book_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.can_edit_library_book(book_id) OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.library_course_learning_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_course_id UUID NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES public.library_chapters(id) ON DELETE SET NULL,
  objective_text TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.library_course_learning_objectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_course_learning_objectives: public read"
  ON public.library_course_learning_objectives FOR SELECT USING (true);

CREATE POLICY "library_course_learning_objectives: course owner manages"
  ON public.library_course_learning_objectives FOR ALL
  USING (public.is_academy_course_owner(academy_course_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_academy_course_owner(academy_course_id) OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.library_chapter_lessons (
  chapter_id UUID PRIMARY KEY REFERENCES public.library_chapters(id) ON DELETE CASCADE,
  academy_lesson_id UUID NOT NULL UNIQUE REFERENCES public.academy_lessons(id) ON DELETE CASCADE
);

ALTER TABLE public.library_chapter_lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_chapter_lessons: public read"
  ON public.library_chapter_lessons FOR SELECT USING (true);

CREATE POLICY "library_chapter_lessons: book editor manages"
  ON public.library_chapter_lessons FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.library_chapters c WHERE c.id = chapter_id AND public.can_edit_library_book(c.book_id))
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.library_chapters c WHERE c.id = chapter_id AND public.can_edit_library_book(c.book_id))
    OR public.has_role(auth.uid(), 'admin')
  );

-- Converts a book's chapters into a real Academy course + lessons the student
-- can enroll in, wiring the chapter<->lesson map used later for progress sync.
CREATE OR REPLACE FUNCTION public.convert_library_book_to_course(
  _book_id UUID, _title TEXT, _level TEXT DEFAULT 'beginner'
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _instructor_id UUID;
  _course_id UUID;
  _module_id UUID;
  _chapter RECORD;
  _lesson_id UUID;
  _book_title TEXT;
  _book_description TEXT;
BEGIN
  IF NOT (public.can_edit_library_book(_book_id) OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Not authorized to convert this book';
  END IF;

  IF EXISTS (SELECT 1 FROM public.library_book_courses WHERE book_id = _book_id) THEN
    RAISE EXCEPTION 'This book has already been converted to a course';
  END IF;

  SELECT title, description INTO _book_title, _book_description FROM public.library_books WHERE id = _book_id;
  IF _book_title IS NULL THEN RAISE EXCEPTION 'Book not found'; END IF;

  SELECT id INTO _instructor_id FROM public.academy_instructors WHERE user_id = auth.uid();
  IF _instructor_id IS NULL THEN
    INSERT INTO public.academy_instructors (user_id, name, verified)
    VALUES (auth.uid(), COALESCE((SELECT display_name FROM public.profiles WHERE user_id = auth.uid()), 'Visionex Author'), true)
    RETURNING id INTO _instructor_id;
  END IF;

  INSERT INTO public.academy_courses (title, description, instructor_id, source, difficulty, status, published, is_free)
  VALUES (COALESCE(_title, _book_title), _book_description, _instructor_id, 'library_book', _level, 'published', true, true)
  RETURNING id INTO _course_id;

  INSERT INTO public.academy_course_modules (course_id, title, order_index)
  VALUES (_course_id, 'Chapters', 0)
  RETURNING id INTO _module_id;

  FOR _chapter IN
    SELECT id, chapter_number, title, content_text
    FROM public.library_chapters WHERE book_id = _book_id ORDER BY chapter_number ASC
  LOOP
    INSERT INTO public.academy_lessons (module_id, course_id, title, kind, order_index, body_markdown)
    VALUES (_module_id, _course_id, COALESCE(_chapter.title, 'Chapter ' || _chapter.chapter_number),
            'text', _chapter.chapter_number, _chapter.content_text)
    RETURNING id INTO _lesson_id;

    INSERT INTO public.library_chapter_lessons (chapter_id, academy_lesson_id)
    VALUES (_chapter.id, _lesson_id)
    ON CONFLICT (chapter_id) DO NOTHING;
  END LOOP;

  INSERT INTO public.library_book_courses (book_id, academy_course_id, created_by)
  VALUES (_book_id, _course_id, auth.uid());

  RETURN _course_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.convert_library_book_to_course(UUID, TEXT, TEXT) TO authenticated;

-- Mirrors a Library reading-progress update into the linked Academy lesson's
-- progress row, so Book-to-Course students see synced completion either side.
CREATE OR REPLACE FUNCTION public.sync_library_progress_to_academy(_chapter_id UUID, _completed BOOLEAN DEFAULT true)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user UUID := auth.uid();
  _lesson_id UUID;
  _course_id UUID;
BEGIN
  IF _user IS NULL THEN RETURN; END IF;

  SELECT cl.academy_lesson_id, l.course_id INTO _lesson_id, _course_id
  FROM public.library_chapter_lessons cl
  JOIN public.academy_lessons l ON l.id = cl.academy_lesson_id
  WHERE cl.chapter_id = _chapter_id;

  IF _lesson_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.academy_lesson_progress (user_id, lesson_id, course_id, completed, updated_at)
  VALUES (_user, _lesson_id, _course_id, _completed, now())
  ON CONFLICT (user_id, lesson_id) DO UPDATE
    SET completed = EXCLUDED.completed, updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_library_progress_to_academy(UUID, BOOLEAN) TO authenticated;

-- ============================================================================
-- 3. SMART NOTES ENHANCEMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.library_notebooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'blue',
  icon TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_notebooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_notebooks: user manages own"
  ON public.library_notebooks FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.library_notes
  ADD COLUMN IF NOT EXISTS note_type TEXT NOT NULL DEFAULT 'text' CHECK (note_type IN ('text', 'voice', 'image')),
  ADD COLUMN IF NOT EXISTS voice_url TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notebook_id UUID REFERENCES public.library_notebooks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_library_notes_content_trgm ON public.library_notes USING GIN (content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_library_notes_tags ON public.library_notes USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_library_notes_notebook ON public.library_notes(notebook_id);

CREATE OR REPLACE FUNCTION public.search_library_notes(_query TEXT, _notebook_id UUID DEFAULT NULL, _tag TEXT DEFAULT NULL)
RETURNS SETOF public.library_notes
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.library_notes
  WHERE user_id = auth.uid()
    AND (_query IS NULL OR _query = '' OR content ILIKE '%' || _query || '%')
    AND (_notebook_id IS NULL OR notebook_id = _notebook_id)
    AND (_tag IS NULL OR _tag = ANY(tags))
  ORDER BY is_pinned DESC, updated_at DESC
$$;

GRANT EXECUTE ON FUNCTION public.search_library_notes(TEXT, UUID, TEXT) TO authenticated;

-- ============================================================================
-- 4. HIGHLIGHTS ENHANCEMENTS
-- ============================================================================

ALTER TABLE public.library_highlights
  ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS note TEXT;

CREATE INDEX IF NOT EXISTS idx_library_highlights_text_trgm ON public.library_highlights USING GIN (quoted_text gin_trgm_ops);

-- ============================================================================
-- 5. FLASHCARDS (structured study system, distinct from the ephemeral
--    reader-sidebar AI flashcards in library_ai_flashcards)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.library_flashcard_decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id UUID REFERENCES public.library_books(id) ON DELETE SET NULL,
  chapter_id UUID REFERENCES public.library_chapters(id) ON DELETE SET NULL,
  learning_path_id UUID REFERENCES public.library_learning_paths(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  is_ai_generated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_flashcard_decks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_flashcard_decks: user manages own"
  ON public.library_flashcard_decks FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.library_flashcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID NOT NULL REFERENCES public.library_flashcard_decks(id) ON DELETE CASCADE,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  image_url TEXT,
  audio_url TEXT,
  difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ai')),
  interval_days NUMERIC NOT NULL DEFAULT 0,
  ease_factor NUMERIC NOT NULL DEFAULT 2.5,
  repetitions INTEGER NOT NULL DEFAULT 0,
  due_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_reviewed_at TIMESTAMPTZ,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_library_flashcards_deck ON public.library_flashcards(deck_id);
CREATE INDEX IF NOT EXISTS idx_library_flashcards_due ON public.library_flashcards(deck_id, due_at);

ALTER TABLE public.library_flashcards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_flashcards: user manages via deck ownership"
  ON public.library_flashcards FOR ALL
  USING (EXISTS (SELECT 1 FROM public.library_flashcard_decks d WHERE d.id = deck_id AND d.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.library_flashcard_decks d WHERE d.id = deck_id AND d.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.library_flashcard_study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deck_id UUID NOT NULL REFERENCES public.library_flashcard_decks(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  cards_reviewed INTEGER NOT NULL DEFAULT 0,
  cards_correct INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.library_flashcard_study_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_flashcard_study_sessions: user manages own"
  ON public.library_flashcard_study_sessions FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.get_library_due_flashcards(_deck_id UUID)
RETURNS SETOF public.library_flashcards
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT f.* FROM public.library_flashcards f
  JOIN public.library_flashcard_decks d ON d.id = f.deck_id
  WHERE f.deck_id = _deck_id AND d.user_id = auth.uid() AND f.due_at <= now()
  ORDER BY f.due_at ASC
$$;

GRANT EXECUTE ON FUNCTION public.get_library_due_flashcards(UUID) TO authenticated;

-- SM-2 spaced-repetition scheduling. _quality is 0-5 (SM-2 recall grade).
CREATE OR REPLACE FUNCTION public.review_library_flashcard(_flashcard_id UUID, _quality INTEGER, _session_id UUID DEFAULT NULL)
RETURNS public.library_flashcards
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _card public.library_flashcards;
  _ease NUMERIC;
  _interval NUMERIC;
  _reps INTEGER;
BEGIN
  IF _quality < 0 OR _quality > 5 THEN RAISE EXCEPTION 'Quality must be between 0 and 5'; END IF;

  SELECT f.* INTO _card FROM public.library_flashcards f
  JOIN public.library_flashcard_decks d ON d.id = f.deck_id
  WHERE f.id = _flashcard_id AND d.user_id = auth.uid();
  IF _card.id IS NULL THEN RAISE EXCEPTION 'Flashcard not found'; END IF;

  IF _quality < 3 THEN
    _reps := 0;
    _interval := 1;
  ELSE
    _reps := _card.repetitions + 1;
    IF _reps = 1 THEN _interval := 1;
    ELSIF _reps = 2 THEN _interval := 6;
    ELSE _interval := round(_card.interval_days * _card.ease_factor);
    END IF;
  END IF;

  _ease := GREATEST(1.3, _card.ease_factor + (0.1 - (5 - _quality) * (0.08 + (5 - _quality) * 0.02)));

  UPDATE public.library_flashcards
  SET repetitions = _reps, ease_factor = _ease, interval_days = _interval,
      due_at = now() + (_interval || ' days')::INTERVAL, last_reviewed_at = now()
  WHERE id = _flashcard_id
  RETURNING * INTO _card;

  IF _session_id IS NOT NULL THEN
    UPDATE public.library_flashcard_study_sessions
    SET cards_reviewed = cards_reviewed + 1,
        cards_correct = cards_correct + CASE WHEN _quality >= 3 THEN 1 ELSE 0 END
    WHERE id = _session_id AND user_id = auth.uid();
  END IF;

  RETURN _card;
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_library_flashcard(UUID, INTEGER, UUID) TO authenticated;

-- ============================================================================
-- 6. QUIZZES (structured system, distinct from the ephemeral reader-sidebar
--    AI quiz in library_ai_quiz_attempts)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.library_quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type TEXT NOT NULL CHECK (scope_type IN ('book', 'chapter', 'course_lesson', 'learning_path', 'custom')),
  book_id UUID REFERENCES public.library_books(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES public.library_chapters(id) ON DELETE CASCADE,
  academy_lesson_id UUID REFERENCES public.academy_lessons(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  is_timed BOOLEAN NOT NULL DEFAULT false,
  time_limit_minutes INTEGER,
  passing_score_percent NUMERIC NOT NULL DEFAULT 70,
  is_adaptive_difficulty BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_learning_path_items
  ADD CONSTRAINT library_learning_path_items_quiz_id_fkey
  FOREIGN KEY (quiz_id) REFERENCES public.library_quizzes(id) ON DELETE SET NULL;

ALTER TABLE public.library_quizzes
  ADD COLUMN IF NOT EXISTS learning_path_item_id UUID REFERENCES public.library_learning_path_items(id) ON DELETE SET NULL;

ALTER TABLE public.library_quizzes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_quizzes: public read metadata"
  ON public.library_quizzes FOR SELECT USING (true);

CREATE POLICY "library_quizzes: creator manages"
  ON public.library_quizzes FOR ALL
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.library_quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.library_quizzes(id) ON DELETE CASCADE,
  question_type TEXT NOT NULL CHECK (question_type IN
    ('multiple_choice', 'true_false', 'short_answer', 'matching', 'fill_blank', 'essay')),
  question_text TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]',
  correct_answer JSONB,
  explanation TEXT,
  difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  topic TEXT,
  points INTEGER NOT NULL DEFAULT 1,
  order_index INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_library_quiz_questions_quiz ON public.library_quiz_questions(quiz_id, order_index);

-- No direct SELECT for authenticated/anon: correct_answer/explanation must
-- never be visible before a student submits. Taking a quiz goes through
-- get_library_quiz_for_attempt(); grading through submit_library_quiz_attempt().
ALTER TABLE public.library_quiz_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_quiz_questions: creator manages"
  ON public.library_quiz_questions FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.library_quizzes q WHERE q.id = quiz_id AND q.created_by = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.library_quizzes q WHERE q.id = quiz_id AND q.created_by = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE TABLE IF NOT EXISTS public.library_quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.library_quizzes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  score_percent NUMERIC,
  time_spent_seconds INTEGER,
  answers JSONB NOT NULL DEFAULT '{}',
  passed BOOLEAN,
  needs_manual_grading BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_library_quiz_attempts_user ON public.library_quiz_attempts(user_id, quiz_id, started_at DESC);

ALTER TABLE public.library_quiz_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_quiz_attempts: user reads own"
  ON public.library_quiz_attempts FOR SELECT
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "library_quiz_attempts: creator can review for grading"
  ON public.library_quiz_attempts FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.library_quizzes q WHERE q.id = quiz_id AND q.created_by = auth.uid()));

CREATE OR REPLACE FUNCTION public.get_library_quiz_for_attempt(_quiz_id UUID)
RETURNS TABLE (id UUID, question_type TEXT, question_text TEXT, options JSONB, difficulty TEXT, topic TEXT, points INTEGER, order_index INTEGER)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT q.id, q.question_type, q.question_text,
         CASE WHEN q.question_type = 'matching' THEN q.options
              WHEN q.question_type = 'multiple_choice' THEN q.options
              ELSE '[]'::jsonb END,
         q.difficulty, q.topic, q.points, q.order_index
  FROM public.library_quiz_questions q
  WHERE q.quiz_id = _quiz_id
  ORDER BY q.order_index ASC
$$;

GRANT EXECUTE ON FUNCTION public.get_library_quiz_for_attempt(UUID) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.start_library_quiz_attempt(_quiz_id UUID)
RETURNS public.library_quiz_attempts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _row public.library_quiz_attempts;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  INSERT INTO public.library_quiz_attempts (quiz_id, user_id)
  VALUES (_quiz_id, auth.uid())
  RETURNING * INTO _row;
  RETURN _row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_library_quiz_attempt(UUID) TO authenticated;

-- Grades objective question types server-side (the client never sees
-- correct answers before this call). _answers is {question_id: answer}.
CREATE OR REPLACE FUNCTION public.submit_library_quiz_attempt(_attempt_id UUID, _answers JSONB, _time_spent_seconds INTEGER DEFAULT NULL)
RETURNS TABLE (question_id UUID, is_correct BOOLEAN, correct_answer JSONB, explanation TEXT, score_percent NUMERIC, passed BOOLEAN, needs_manual_grading BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _quiz_id UUID;
  _user UUID := auth.uid();
  _q RECORD;
  _given JSONB;
  _correct BOOLEAN;
  _earned NUMERIC := 0;
  _total NUMERIC := 0;
  _manual BOOLEAN := false;
  _passing NUMERIC;
  _score NUMERIC;
  _passed BOOLEAN;
BEGIN
  SELECT quiz_id INTO _quiz_id FROM public.library_quiz_attempts WHERE id = _attempt_id AND user_id = _user;
  IF _quiz_id IS NULL THEN RAISE EXCEPTION 'Attempt not found'; END IF;

  SELECT passing_score_percent INTO _passing FROM public.library_quizzes WHERE id = _quiz_id;

  -- First pass: compute totals only (no RETURN NEXT yet) so score_percent/
  -- passed can be included on every output row, not just known after the loop.
  FOR _q IN SELECT * FROM public.library_quiz_questions WHERE quiz_id = _quiz_id ORDER BY order_index LOOP
    _given := _answers -> _q.id::text;
    _total := _total + _q.points;

    IF _q.question_type = 'essay' THEN
      _correct := NULL;
      _manual := true;
    ELSIF _q.question_type IN ('multiple_choice', 'true_false', 'matching') THEN
      _correct := (_given = _q.correct_answer);
    ELSE -- short_answer, fill_blank: normalized text compare
      _correct := (lower(trim(both FROM regexp_replace(COALESCE(_given #>> '{}', ''), '\s+', ' ', 'g')))
                 = lower(trim(both FROM regexp_replace(COALESCE(_q.correct_answer #>> '{}', ''), '\s+', ' ', 'g'))));
    END IF;

    IF _correct IS TRUE THEN _earned := _earned + _q.points; END IF;
  END LOOP;

  _score := CASE WHEN _total > 0 THEN round(_earned / _total * 100, 1) ELSE 0 END;
  _passed := (NOT _manual) AND _score >= _passing;

  UPDATE public.library_quiz_attempts
  SET submitted_at = now(), answers = _answers, score_percent = _score, passed = _passed,
      needs_manual_grading = _manual, time_spent_seconds = _time_spent_seconds
  WHERE id = _attempt_id;

  IF NOT _manual THEN
    IF _passed THEN
      PERFORM public.award_library_xp(LEAST(40, GREATEST(5, round(_score / 5))), 'Quiz passed:' || _quiz_id::text);
    END IF;
    IF _score >= 100 THEN
      PERFORM public.check_and_award_library_achievement(_user, 'quiz_master');
    END IF;
  END IF;

  -- Second pass: emit one row per question, now with the final score/passed
  -- already known, for the client to render per-question + overall results.
  FOR _q IN SELECT * FROM public.library_quiz_questions WHERE quiz_id = _quiz_id ORDER BY order_index LOOP
    _given := _answers -> _q.id::text;

    IF _q.question_type = 'essay' THEN
      _correct := NULL;
    ELSIF _q.question_type IN ('multiple_choice', 'true_false', 'matching') THEN
      _correct := (_given = _q.correct_answer);
    ELSE
      _correct := (lower(trim(both FROM regexp_replace(COALESCE(_given #>> '{}', ''), '\s+', ' ', 'g')))
                 = lower(trim(both FROM regexp_replace(COALESCE(_q.correct_answer #>> '{}', ''), '\s+', ' ', 'g'))));
    END IF;

    question_id := _q.id; is_correct := _correct; correct_answer := _q.correct_answer;
    explanation := _q.explanation; score_percent := _score; passed := _passed; needs_manual_grading := (_q.question_type = 'essay');
    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_library_quiz_attempt(UUID, JSONB, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_library_weak_topics(_user_id UUID DEFAULT NULL)
RETURNS TABLE (topic TEXT, accuracy_percent NUMERIC, attempts_count BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH target AS (SELECT COALESCE(_user_id, auth.uid()) AS uid)
  SELECT qq.topic,
         round(100.0 * sum(CASE WHEN (qa.answers -> qq.id::text) = qq.correct_answer THEN 1 ELSE 0 END) / count(*), 1) AS accuracy_percent,
         count(*) AS attempts_count
  FROM public.library_quiz_attempts qa
  JOIN public.library_quiz_questions qq ON qq.quiz_id = qa.quiz_id
  JOIN target t ON qa.user_id = t.uid
  WHERE qa.submitted_at IS NOT NULL AND qq.topic IS NOT NULL AND qq.question_type NOT IN ('essay')
  GROUP BY qq.topic
  HAVING count(*) >= 2 AND (sum(CASE WHEN (qa.answers -> qq.id::text) = qq.correct_answer THEN 1 ELSE 0 END)::NUMERIC / count(*)) < 0.7
  ORDER BY accuracy_percent ASC
$$;

GRANT EXECUTE ON FUNCTION public.get_library_weak_topics(UUID) TO authenticated;

-- ============================================================================
-- 7. CERTIFICATES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.library_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  certificate_type TEXT NOT NULL CHECK (certificate_type IN
    ('learning_path', 'course', 'exam', 'reading_challenge', 'skill_mastery')),
  reference_id UUID NOT NULL,
  title TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  issuer_name TEXT NOT NULL DEFAULT 'Visionex Academy & Library',
  score_percent NUMERIC,
  certificate_number TEXT NOT NULL UNIQUE,
  verification_code TEXT NOT NULL UNIQUE,
  signature_hash TEXT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_library_certificates_user ON public.library_certificates(user_id, issued_at DESC);

ALTER TABLE public.library_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_certificates: user reads own"
  ON public.library_certificates FOR SELECT
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Deliberately no INSERT/UPDATE policy for authenticated/anon: issuance is
-- performed exclusively by the library-issue-certificate edge function using
-- the service role (which bypasses RLS), after it verifies eligibility and
-- computes an HMAC signature with a secret the client never has access to.

CREATE OR REPLACE FUNCTION public.verify_library_certificate(_certificate_number TEXT)
RETURNS TABLE (
  title TEXT, recipient_name TEXT, issuer_name TEXT, certificate_type TEXT,
  score_percent NUMERIC, issued_at TIMESTAMPTZ, verification_code TEXT, signature_hash TEXT, is_valid BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.title, c.recipient_name, c.issuer_name, c.certificate_type,
         c.score_percent, c.issued_at, c.verification_code, c.signature_hash,
         (c.signature_hash IS NOT NULL) AS is_valid
  FROM public.library_certificates c
  WHERE c.certificate_number = _certificate_number
$$;

GRANT EXECUTE ON FUNCTION public.verify_library_certificate(TEXT) TO anon, authenticated;

-- ============================================================================
-- 8. GROUP LEARNING (study groups on top of the existing Reading Community
--    clubs/discussions infrastructure)
-- ============================================================================

ALTER TABLE public.library_clubs
  ADD COLUMN IF NOT EXISTS learning_path_id UUID REFERENCES public.library_learning_paths(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS academy_course_id UUID REFERENCES public.academy_courses(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.library_group_shared_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.library_clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_group_shared_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_group_shared_notes: members read"
  ON public.library_group_shared_notes FOR SELECT
  USING (public.is_library_club_member(club_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "library_group_shared_notes: members write own"
  ON public.library_group_shared_notes FOR INSERT
  WITH CHECK (user_id = auth.uid() AND public.is_library_club_member(club_id));

CREATE POLICY "library_group_shared_notes: author or moderator updates"
  ON public.library_group_shared_notes FOR UPDATE
  USING (user_id = auth.uid() OR public.is_library_club_moderator(club_id));

CREATE POLICY "library_group_shared_notes: author or moderator deletes"
  ON public.library_group_shared_notes FOR DELETE
  USING (user_id = auth.uid() OR public.is_library_club_moderator(club_id));

CREATE TRIGGER library_group_shared_notes_updated_at
  BEFORE UPDATE ON public.library_group_shared_notes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.library_group_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.library_clubs(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_group_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_group_assignments: members read"
  ON public.library_group_assignments FOR SELECT
  USING (public.is_library_club_member(club_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "library_group_assignments: moderator manages"
  ON public.library_group_assignments FOR ALL
  USING (public.is_library_club_moderator(club_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_library_club_moderator(club_id) OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.library_group_assignment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.library_group_assignments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT,
  file_url TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, user_id)
);

ALTER TABLE public.library_group_assignment_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_group_assignment_submissions: club members read"
  ON public.library_group_assignment_submissions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.library_group_assignments a WHERE a.id = assignment_id AND public.is_library_club_member(a.club_id))
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "library_group_assignment_submissions: user submits own"
  ON public.library_group_assignment_submissions FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.library_group_assignments a WHERE a.id = assignment_id AND public.is_library_club_member(a.club_id))
  );

CREATE POLICY "library_group_assignment_submissions: user updates own before review"
  ON public.library_group_assignment_submissions FOR UPDATE
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.library_group_peer_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.library_group_assignment_submissions(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (submission_id, reviewer_id)
);

ALTER TABLE public.library_group_peer_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_group_peer_reviews: club members read"
  ON public.library_group_peer_reviews FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.library_group_assignment_submissions s
      JOIN public.library_group_assignments a ON a.id = s.assignment_id
      WHERE s.id = submission_id AND public.is_library_club_member(a.club_id)
    )
  );

CREATE POLICY "library_group_peer_reviews: member reviews others work"
  ON public.library_group_peer_reviews FOR INSERT
  WITH CHECK (
    reviewer_id = auth.uid()
    AND NOT EXISTS (SELECT 1 FROM public.library_group_assignment_submissions s WHERE s.id = submission_id AND s.user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.library_group_assignment_submissions s
      JOIN public.library_group_assignments a ON a.id = s.assignment_id
      WHERE s.id = submission_id AND public.is_library_club_member(a.club_id)
    )
  );

CREATE TABLE IF NOT EXISTS public.library_group_teacher_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.library_group_assignment_submissions(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES auth.users(id),
  feedback TEXT NOT NULL,
  grade TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_group_teacher_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_group_teacher_feedback: club members read"
  ON public.library_group_teacher_feedback FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.library_group_assignment_submissions s
      JOIN public.library_group_assignments a ON a.id = s.assignment_id
      WHERE s.id = submission_id AND public.is_library_club_member(a.club_id)
    )
  );

CREATE POLICY "library_group_teacher_feedback: instructor or moderator writes"
  ON public.library_group_teacher_feedback FOR INSERT
  WITH CHECK (
    instructor_id = auth.uid()
    AND (
      public.is_library_academy_instructor()
      OR public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.library_group_assignment_submissions s
        JOIN public.library_group_assignments a ON a.id = s.assignment_id
        WHERE s.id = submission_id AND public.is_library_club_moderator(a.club_id)
      )
    )
  );

-- ============================================================================
-- 9. ACADEMY INTEGRATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.library_academy_course_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_course_id UUID NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  is_required BOOLEAN NOT NULL DEFAULT true,
  order_index INTEGER NOT NULL DEFAULT 0,
  UNIQUE (academy_course_id, book_id)
);

ALTER TABLE public.library_academy_course_books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_academy_course_books: public read"
  ON public.library_academy_course_books FOR SELECT USING (true);

CREATE POLICY "library_academy_course_books: course or book owner manages"
  ON public.library_academy_course_books FOR ALL
  USING (public.is_academy_course_owner(academy_course_id) OR public.can_edit_library_book(book_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_academy_course_owner(academy_course_id) OR public.can_edit_library_book(book_id) OR public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.library_reading_lists
  ADD COLUMN IF NOT EXISTS academy_course_id UUID REFERENCES public.academy_courses(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.library_instructor_book_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID NOT NULL REFERENCES public.academy_instructors(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (instructor_id, book_id)
);

ALTER TABLE public.library_instructor_book_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_instructor_book_recommendations: public read"
  ON public.library_instructor_book_recommendations FOR SELECT USING (true);

CREATE POLICY "library_instructor_book_recommendations: instructor manages own"
  ON public.library_instructor_book_recommendations FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.academy_instructors i WHERE i.id = instructor_id AND i.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.academy_instructors i WHERE i.id = instructor_id AND i.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- ============================================================================
-- 10. ACHIEVEMENTS + XP BRANCHES
-- ============================================================================

INSERT INTO public.library_achievements (code, name, description, icon, criteria, reward_vx) VALUES
  ('course_completed_via_library', 'Book Scholar', 'Completed a course converted from a Library book', 'graduation-cap', '{}', 50),
  ('first_certificate_earned', 'Certified', 'Earned your first Learning Hub certificate', 'award', '{}', 30),
  ('quiz_master', 'Quiz Master', 'Scored 100% on a quiz', 'brain', '{}', 25),
  ('flashcard_streak_7', 'Spaced Repeater', 'Studied flashcards 7 days in a row', 'layers', '{}', 30),
  ('learning_path_completed', 'Path Finisher', 'Completed a full learning path', 'route', '{}', 75),
  ('study_group_joined', 'Study Buddy', 'Joined your first study group', 'users', '{}', 15)
ON CONFLICT (code) DO NOTHING;

CREATE OR REPLACE FUNCTION public.award_library_xp(_amount INTEGER, _reason TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _max_amount INTEGER;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Must be signed in';
  END IF;
  IF _amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  CASE
    WHEN _reason LIKE 'Book completed:%'        THEN _max_amount := 100;
    WHEN _reason LIKE 'Review written:%'        THEN _max_amount := 25;
    WHEN _reason LIKE 'Reading streak:%'        THEN _max_amount := 50;
    WHEN _reason LIKE 'Challenge completed:%'   THEN _max_amount := 300;
    WHEN _reason LIKE 'Daily reading goal:%'    THEN _max_amount := 20;
    WHEN _reason LIKE 'Club created:%'          THEN _max_amount := 20;
    WHEN _reason LIKE 'Event attended:%'        THEN _max_amount := 30;
    WHEN _reason LIKE 'Course completed:%'      THEN _max_amount := 150;
    WHEN _reason LIKE 'Quiz passed:%'           THEN _max_amount := 40;
    WHEN _reason LIKE 'Flashcard review:%'      THEN _max_amount := 10;
    WHEN _reason LIKE 'Certificate earned:%'    THEN _max_amount := 50;
    WHEN _reason LIKE 'Learning path completed:%' THEN _max_amount := 200;
    ELSE RAISE EXCEPTION 'Invalid reason: %', _reason;
  END CASE;

  IF _amount > _max_amount THEN
    RAISE EXCEPTION 'Amount exceeds maximum (%) for reason: %', _max_amount, _reason;
  END IF;

  INSERT INTO public.library_xp_events(user_id, amount, reason)
  VALUES (_user_id, _amount, _reason);

  INSERT INTO public.user_points(user_id, points, reason)
  VALUES (_user_id, _amount, _reason);
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_library_xp(INTEGER, TEXT) TO authenticated;

-- Award the study-group achievement whenever a club with a learning_path_id
-- or academy_course_id gains a new member (i.e. a real "study group" join).
CREATE OR REPLACE FUNCTION public.trg_check_library_study_group_achievement()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.library_clubs c
    WHERE c.id = NEW.club_id AND (c.learning_path_id IS NOT NULL OR c.academy_course_id IS NOT NULL)
  ) THEN
    PERFORM public.check_and_award_library_achievement(NEW.user_id, 'study_group_joined');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_library_club_members_study_group_achievement
  AFTER INSERT ON public.library_club_members
  FOR EACH ROW EXECUTE FUNCTION public.trg_check_library_study_group_achievement();

-- Award course-completion achievement + XP when an Academy enrollment for a
-- Book-to-Course-converted course is marked completed.
CREATE OR REPLACE FUNCTION public.trg_check_library_course_completion_achievement()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _newly_completed BOOLEAN := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _newly_completed := NEW.completed_at IS NOT NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.completed_at IS NULL THEN
      _newly_completed := NEW.completed_at IS NOT NULL;
    END IF;
  END IF;

  IF _newly_completed THEN
    IF EXISTS (SELECT 1 FROM public.library_book_courses WHERE academy_course_id = NEW.course_id) THEN
      PERFORM public.check_and_award_library_achievement(NEW.user_id, 'course_completed_via_library');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_academy_enrollments_library_course_achievement
  AFTER INSERT OR UPDATE OF completed_at ON public.academy_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.trg_check_library_course_completion_achievement();

CREATE OR REPLACE FUNCTION public.trg_check_library_first_certificate_achievement()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.check_and_award_library_achievement(NEW.user_id, 'first_certificate_earned');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_library_certificates_first_achievement
  AFTER INSERT ON public.library_certificates
  FOR EACH ROW EXECUTE FUNCTION public.trg_check_library_first_certificate_achievement();

-- ============================================================================
-- 11. CONSOLIDATED READING/LEARNING ANALYTICS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_library_learning_analytics(_book_id UUID DEFAULT NULL)
RETURNS TABLE (
  reading_speed_wpm NUMERIC, avg_quiz_score_percent NUMERIC, study_time_minutes NUMERIC,
  knowledge_retention_percent NUMERIC, flashcards_due INTEGER, quizzes_taken INTEGER, current_streak INTEGER
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user UUID := auth.uid();
BEGIN
  RETURN QUERY
  WITH reading AS (
    SELECT COALESCE(sum(minutes_read), 0) AS minutes, COALESCE(sum(pages_read), 0) AS pages
    FROM public.library_reading_daily_activity WHERE user_id = _user
  ),
  quiz AS (
    SELECT avg(score_percent) AS avg_score, count(*) AS attempts,
           COALESCE(sum(time_spent_seconds), 0) AS quiz_seconds
    FROM public.library_quiz_attempts
    WHERE user_id = _user AND submitted_at IS NOT NULL
      AND (_book_id IS NULL OR quiz_id IN (SELECT id FROM public.library_quizzes WHERE book_id = _book_id))
  ),
  flash AS (
    SELECT count(*) FILTER (WHERE f.due_at <= now()) AS due,
           count(*) FILTER (WHERE f.repetitions >= 2) AS retained,
           count(*) AS total
    FROM public.library_flashcards f
    JOIN public.library_flashcard_decks d ON d.id = f.deck_id
    WHERE d.user_id = _user AND (_book_id IS NULL OR d.book_id = _book_id)
  ),
  study_sessions AS (
    SELECT COALESCE(sum(extract(epoch FROM (COALESCE(ended_at, started_at) - started_at))), 0) / 60 AS minutes
    FROM public.library_flashcard_study_sessions WHERE user_id = _user
  )
  SELECT
    CASE WHEN reading.minutes > 0 THEN round((reading.pages * 275.0) / reading.minutes, 0) ELSE 0 END,
    round(quiz.avg_score, 1),
    reading.minutes + (quiz.quiz_seconds / 60.0) + study_sessions.minutes,
    CASE WHEN flash.total > 0 THEN round(100.0 * flash.retained / flash.total, 1) ELSE NULL END,
    flash.due::INTEGER,
    quiz.attempts::INTEGER,
    public.get_library_reading_streak(_user)
  FROM reading, quiz, flash, study_sessions;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_library_learning_analytics(UUID) TO authenticated;
