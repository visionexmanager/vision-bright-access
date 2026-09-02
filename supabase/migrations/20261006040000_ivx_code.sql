-- IVX — code questions, and where the code actually runs.
--
-- ── The problem, stated honestly ────────────────────────────────────────────
--
-- A code question needs two things that pull in opposite directions: somebody
-- has to *execute* untrusted code, and somebody has to *decide* whether it was
-- right. Those do not have to be the same somebody, and this is the whole
-- design:
--
--   * Execution happens in the student's own browser, in a Web Worker with no
--     DOM, no page access and its network functions removed. It is their
--     machine and their code; an endless loop costs them a terminated worker
--     and nothing else. No server ever runs a stranger's code.
--   * Grading happens here, in SQL, against expected outputs the browser is
--     never sent.
--
-- What the client returns is the **outputs its run produced**, not a verdict.
-- So a client that lies has to invent the right outputs for every case — which
-- is the same work as solving the problem. That is the property that makes
-- browser execution safe to trust: not that the sandbox cannot be escaped, but
-- that escaping it buys nothing.
--
-- ── Why not run it on a server ──────────────────────────────────────────────
--
-- Because the only honest way to do that is a real isolate with real resource
-- limits, and standing one up would mean a new Edge Function holding a WASM
-- interpreter that nothing in this repository can execute or test before it
-- reaches production. A sandbox nobody has run is not a sandbox. The browser
-- Worker is a boundary the platform already implements and the student already
-- trusts with the rest of the page.
--
-- ── The shape of a code answer ─────────────────────────────────────────────
--
--   {
--     "entry": "solve",
--     "shown": 1,
--     "cases": [ { "in": [3, 4], "out": 7 }, { "in": [0, 0], "out": 0 } ]
--   }
--
-- `shown` is how many cases come with their expected output as a worked
-- example. Every case's *inputs* are given — they have to be, to run — but the
-- rest of the outputs stay here.

-- ── What the student is allowed to see ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.ivx_code_task(
  _question_id uuid,
  _language    text DEFAULT 'en'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := (select auth.uid());
  _q       public.ivx_questions%ROWTYPE;
  _shown   integer;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  -- Only the question this student has open. Without this, the inputs to every
  -- code question in the bank could be walked by id — and while inputs are not
  -- secret, a question they were never dealt is not theirs to work on.
  IF NOT EXISTS (
    SELECT 1 FROM public.ivx_sessions
     WHERE user_id = _user_id AND open_question = _question_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_the_open_question');
  END IF;

  SELECT * INTO _q FROM public.ivx_questions WHERE id = _question_id AND is_active;
  IF _q.id IS NULL OR _q.kind <> 'code' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_a_code_question');
  END IF;

  _shown := GREATEST(0, COALESCE((_q.answer ->> 'shown')::integer, 1));

  RETURN jsonb_build_object(
    'ok', true,
    'entry', COALESCE(_q.answer ->> 'entry', 'solve'),
    -- Inputs for every case, expected output for the worked examples only.
    -- `ordinality` rather than a join, so the order the student's outputs come
    -- back in is the order they are checked in.
    'cases', COALESCE((
      SELECT jsonb_agg(
               CASE WHEN ord <= _shown
                    THEN jsonb_build_object('in', c -> 'in', 'out', c -> 'out', 'example', true)
                    ELSE jsonb_build_object('in', c -> 'in', 'example', false)
               END ORDER BY ord)
        FROM jsonb_array_elements(_q.answer -> 'cases') WITH ORDINALITY AS t(c, ord)
    ), '[]'::jsonb),
    'starter', COALESCE(_q.answer ->> 'starter', ''),
    'language', COALESCE(_language, 'en')
  );
END;
$$;

COMMENT ON FUNCTION public.ivx_code_task(uuid, text) IS
  'The inputs a code question runs against, plus the worked examples. Expected outputs for the remaining cases stay in ivx_questions.answer and are never projected.';

-- ── Checking the outputs ────────────────────────────────────────────────────
--
-- `ivx_answer_matches` grows one branch rather than the engine growing a
-- second grading path. Everything downstream — `ivx_grade`, the attempt row,
-- mastery, XP, the WhatsApp door — keeps working unchanged, because a code
-- question is still "an answer that either matches or does not".

CREATE OR REPLACE FUNCTION public.ivx_answer_matches(_answer jsonb, _given text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  _expected text;
  _tol      numeric;
  _given_n  numeric;
  _exp_n    numeric;
  _produced jsonb;
  _cases    jsonb;
  _n        integer;
BEGIN
  IF _given IS NULL THEN RETURN false; END IF;

  -- ── Code: an array of produced outputs, one per case, in order ──────────
  IF _answer ? 'cases' THEN
    _cases := _answer -> 'cases';

    BEGIN
      _produced := _given::jsonb;
    EXCEPTION WHEN OTHERS THEN
      -- Not JSON at all. A student who typed prose into a code question has
      -- not passed; they have not run anything.
      RETURN false;
    END;

    IF jsonb_typeof(_produced) <> 'array'
       OR jsonb_array_length(_produced) <> jsonb_array_length(_cases) THEN
      RETURN false;
    END IF;

    FOR _n IN 0 .. jsonb_array_length(_cases) - 1 LOOP
      -- Strict value equality, but numbers compare as numbers so that 7 and
      -- 7.0 are one answer. Anything else — arrays, strings, objects, null —
      -- must match exactly, because in code it usually does matter.
      IF jsonb_typeof(_cases -> _n -> 'out') = 'number'
         AND jsonb_typeof(_produced -> _n) = 'number' THEN
        IF (_cases -> _n ->> 'out')::numeric <> (_produced -> _n)::text::numeric THEN
          RETURN false;
        END IF;
      ELSIF (_cases -> _n -> 'out') <> (_produced -> _n) THEN
        RETURN false;
      END IF;
    END LOOP;

    RETURN true;
  END IF;

  _expected := COALESCE(_answer ->> 'value', '');
  _tol      := COALESCE((_answer ->> 'tolerance')::numeric, 0);

  -- Numeric answers compare as numbers, with a tolerance, so "0.75", ".75" and
  -- "0.750" are one answer and not three. A fraction is accepted written as
  -- one: a learner typing 3/4 has answered the question.
  BEGIN
    _given_n := CASE
      WHEN btrim(_given) ~ '^-?\d+\s*/\s*\d+$'
        THEN split_part(replace(btrim(_given), ' ', ''), '/', 1)::numeric
             / NULLIF(split_part(replace(btrim(_given), ' ', ''), '/', 2)::numeric, 0)
      ELSE btrim(_given)::numeric
    END;
    _exp_n := CASE
      WHEN btrim(_expected) ~ '^-?\d+\s*/\s*\d+$'
        THEN split_part(replace(btrim(_expected), ' ', ''), '/', 1)::numeric
             / NULLIF(split_part(replace(btrim(_expected), ' ', ''), '/', 2)::numeric, 0)
      ELSE btrim(_expected)::numeric
    END;
    IF _given_n IS NOT NULL AND _exp_n IS NOT NULL THEN
      RETURN abs(_given_n - _exp_n) <= GREATEST(_tol, 0);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Not numeric on one side or the other; fall through to text.
    NULL;
  END;

  -- Text compares case-insensitively and ignores surrounding space and Arabic
  -- or Latin final punctuation, because none of those is what was being taught.
  RETURN lower(btrim(regexp_replace(_given, '[\s.،,!؟?]+$', ''))) =
         lower(btrim(regexp_replace(_expected, '[\s.،,!؟?]+$', '')));
END;
$$;

-- ── What the student wrote ──────────────────────────────────────────────────
--
-- Kept because it is the only artefact of a code attempt worth reading again:
-- the outputs land in `ivx_attempts.given` and mean nothing on their own, and
-- the tutor explaining "your loop stops one short" needs the loop.

CREATE TABLE IF NOT EXISTS public.ivx_code_runs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.ivx_questions(id) ON DELETE CASCADE,
  source      text NOT NULL,
  passed      boolean NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ivx_code_runs_user_idx
  ON public.ivx_code_runs(user_id, question_id, created_at DESC);

ALTER TABLE public.ivx_code_runs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ivx_code_runs' AND policyname = 'ivx_code_runs_own'
  ) THEN
    CREATE POLICY "ivx_code_runs_own" ON public.ivx_code_runs
      FOR SELECT USING ((select auth.uid()) = user_id);
  END IF;
END $$;

GRANT SELECT ON public.ivx_code_runs TO authenticated;
GRANT ALL    ON public.ivx_code_runs TO service_role;

/**
 * Hand in a code answer.
 *
 * One call so the source and the outcome cannot disagree — the source is
 * written with the verdict that was reached for it, not separately and hoped
 * to line up.
 *
 * Grading is `ivx_submit_answer`, unchanged. This adds no second path to
 * mastery: the outputs go in as `_given`, `ivx_answer_matches` compares them
 * to the stored cases, and everything after that is the engine that was
 * already there.
 */
CREATE OR REPLACE FUNCTION public.ivx_code_submit(
  _question_id uuid,
  _source      text,
  _outputs     jsonb,
  _hints       integer DEFAULT 0,
  _elapsed_ms  integer DEFAULT NULL,
  _language    text DEFAULT 'en'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := (select auth.uid());
  _result  jsonb;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  -- `ivx_submit_answer` derives the student from auth.uid() as well, and it
  -- is that call — not this one — that enforces "only the open question".
  _result := public.ivx_submit_answer(
    _question_id,
    COALESCE(_outputs, 'null'::jsonb)::text,
    _hints,
    _elapsed_ms,
    _language
  );

  IF (_result ->> 'ok')::boolean THEN
    INSERT INTO public.ivx_code_runs (user_id, question_id, source, passed)
    VALUES (_user_id, _question_id, left(COALESCE(_source, ''), 20000),
            COALESCE((_result ->> 'correct')::boolean, false));
  END IF;

  RETURN _result;
END;
$$;

-- ── Permissions ─────────────────────────────────────────────────────────────

DO $$
DECLARE _fn text;
BEGIN
  FOREACH _fn IN ARRAY ARRAY[
    'public.ivx_code_task(uuid, text)',
    'public.ivx_code_submit(uuid, text, jsonb, integer, integer, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', _fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', _fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', _fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', _fn);
  END LOOP;
END $$;

-- ── The first code questions ────────────────────────────────────────────────
--
-- JavaScript, and only under `prog.thinking`. The runner is a Web Worker, so
-- JavaScript is what it can execute — and putting a JavaScript exercise under
-- `prog.python-basics` would be teaching one language while claiming another.
-- Python questions there stay written questions until something can run
-- Python, which is the honest state rather than a broken one.
--
-- Every prompt says in words what the function receives and returns, because
-- a signature shown only as a code block is a signature a screen reader reads
-- as punctuation.

INSERT INTO public.ivx_questions (skill_slug, kind, prompt, options, answer, explanation, hint, accessible, difficulty)
VALUES

('prog.thinking', 'code',
 '{"en":"Write a function called solve that takes two numbers and returns the larger one. If they are equal, return either.","ar":"اكتب دالة اسمها solve تأخذ عددين وتعيد الأكبر منهما. وإن تساويا فأعِد أياً منهما."}',
 '[]',
 '{"entry":"solve","shown":1,"starter":"function solve(a, b) {\n  \n}",
   "cases":[{"in":[3,7],"out":7},{"in":[10,2],"out":10},{"in":[-5,-9],"out":-5},{"in":[4,4],"out":4},{"in":[0,-1],"out":0}]}',
 '{"en":"A comparison and a choice. Anything that returns the larger value passes — an if, a ternary, or Math.max.","ar":"مقارنة واختيار. أي حل يعيد القيمة الأكبر ينجح — شرط if أو عامل ثلاثي أو Math.max."}',
 '{"en":"Compare a and b, then return whichever is bigger.","ar":"قارن a و b ثم أعِد الأكبر."}',
 '{"en":"The function is named solve. It receives two numbers, called a and b, and returns one number.","ar":"اسم الدالة solve. تستقبل عددين اسمهما a و b وتعيد عدداً واحداً."}',
 2),

('prog.thinking', 'code',
 '{"en":"Write a function called solve that takes an array of numbers and returns their total. An empty array totals zero.","ar":"اكتب دالة اسمها solve تأخذ مصفوفة أعداد وتعيد مجموعها. المصفوفة الفارغة مجموعها صفر."}',
 '[]',
 '{"entry":"solve","shown":1,"starter":"function solve(numbers) {\n  \n}",
   "cases":[{"in":[[1,2,3]],"out":6},{"in":[[]],"out":0},{"in":[[-4,4]],"out":0},{"in":[[10]],"out":10},{"in":[[1.5,2.5]],"out":4}]}',
 '{"en":"Start a running total at zero and add each item to it. Starting at zero is what makes the empty array work without a special case.","ar":"ابدأ بمجموع مقداره صفر وأضف إليه كل عنصر. البدء من الصفر هو ما يجعل المصفوفة الفارغة تعمل دون حالة خاصة."}',
 '{"en":"Begin with a total of zero, then loop through the array adding each number.","ar":"ابدأ بمجموع صفر ثم مُرّ على المصفوفة مضيفاً كل عدد."}',
 '{"en":"The function is named solve. It receives one argument, an array of numbers, and returns one number.","ar":"اسم الدالة solve. تستقبل وسيطاً واحداً هو مصفوفة أعداد وتعيد عدداً واحداً."}',
 3),

('prog.thinking', 'code',
 '{"en":"Write a function called solve that takes a word and returns it reversed. Keep the letters as they are — do not change their case.","ar":"اكتب دالة اسمها solve تأخذ كلمة وتعيدها معكوسة. أبقِ الحروف كما هي دون تغيير حالتها."}',
 '[]',
 '{"entry":"solve","shown":1,"starter":"function solve(word) {\n  \n}",
   "cases":[{"in":["cat"],"out":"tac"},{"in":[""],"out":""},{"in":["a"],"out":"a"},{"in":["Level"],"out":"leveL"},{"in":["12345"],"out":"54321"}]}',
 '{"en":"Walk the word from the last character to the first, or split it into characters, reverse them and join them back.","ar":"امشِ على الكلمة من آخر حرف إلى أولها، أو قسّمها إلى حروف واعكسها ثم أعِد جمعها."}',
 '{"en":"Either loop backwards from the end, or use split, reverse and join.","ar":"إما أن تدور من النهاية إلى البداية، أو تستخدم split ثم reverse ثم join."}',
 '{"en":"The function is named solve. It receives one argument, a piece of text, and returns a piece of text.","ar":"اسم الدالة solve. تستقبل وسيطاً واحداً هو نص وتعيد نصاً."}',
 3),

('prog.thinking', 'code',
 '{"en":"Write a function called solve that takes a number and returns how many of the numbers from 1 up to it, including it, divide it exactly. For 6 that is 1, 2, 3 and 6, so four.","ar":"اكتب دالة اسمها solve تأخذ عدداً وتعيد كم عدداً من 1 إلى ذلك العدد، شاملاً إياه، يقسمه تماماً. مثلاً 6 يقسمه 1 و2 و3 و6، أي أربعة."}',
 '[]',
 '{"entry":"solve","shown":1,"starter":"function solve(n) {\n  \n}",
   "cases":[{"in":[6],"out":4},{"in":[1],"out":1},{"in":[7],"out":2},{"in":[12],"out":6},{"in":[16],"out":5}]}',
 '{"en":"Count, do not list. Loop from 1 to the number, and add one to a counter every time the remainder is zero — that is what the percent operator gives you.","ar":"عُدّ ولا تسرد. دُر من 1 إلى العدد، وزد العدّاد كلما كان الباقي صفراً — وهذا ما يعطيه عامل النسبة المئوية."}',
 '{"en":"Use the remainder operator: if n % i is zero, then i divides n exactly.","ar":"استخدم عامل الباقي: إذا كان n % i يساوي صفراً فإن i يقسم n تماماً."}',
 '{"en":"The function is named solve. It receives one argument, a whole number, and returns a whole number.","ar":"اسم الدالة solve. تستقبل وسيطاً واحداً هو عدد صحيح وتعيد عدداً صحيحاً."}',
 4)

-- Re-runnable: a prompt is unique enough to identify a seeded question, and
-- there is no natural key on this table to conflict against.
ON CONFLICT DO NOTHING;

DELETE FROM public.ivx_questions a
 USING public.ivx_questions b
 WHERE a.kind = 'code'
   AND b.kind = 'code'
   AND a.prompt = b.prompt
   AND a.ctid > b.ctid;
