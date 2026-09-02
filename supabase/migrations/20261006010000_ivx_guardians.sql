-- IVX — the parent and teacher view.
--
-- ── Who may watch whom, and who decides ─────────────────────────────────────
--
-- The link is issued by the **student**, never by the guardian. A parent or a
-- teacher cannot search for a child, cannot attach themselves by email, and
-- cannot be added by an administrator: the student generates a code and hands
-- it over, and only then does anything become visible.
--
-- That direction is the whole design. The other way round — a guardian enters
-- an email address and starts watching — is a feature that works exactly as
-- well for somebody who should not be watching, and there is no follow-up
-- check that repairs it. A code the student chose to give out is consent that
-- happened, rather than consent assumed.
--
-- Either side can end it, at any time, and ending it is immediate.
--
-- ── What a guardian sees, and what they do not ──────────────────────────────
--
-- They see progress: mastery per skill, how much practice, how recently, the
-- streak, and which skill is struggling. That is what lets somebody help.
--
-- They do not see:
--
--   * the tutoring conversation. A student asking "I feel stupid, explain it
--     again" is talking to a tutor, not filing a report, and a transcript that
--     a parent can read is a transcript the student will stop being honest in.
--   * what they typed. "Wrong three times on adding fractions" is the useful
--     fact; the exact wrong answers are the student's own working.
--   * anything outside IVX. The link grants a view of practice, not of an
--     account.
--
-- Those omissions are load-bearing, not oversights. `ivx_guardian_progress`
-- below is the entire projection, and it names every field it returns.

-- ── The link ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ivx_guardians (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Null until somebody redeems the code. A pending row is an invitation, not
  -- a relationship.
  guardian_user_id  uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  relation          text NOT NULL DEFAULT 'parent' CHECK (relation IN ('parent','teacher')),
  -- What the student calls this link in their own list ("Mum", "Ms Haddad").
  label             text NOT NULL DEFAULT '',
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','revoked')),
  invite_code       text UNIQUE,
  invite_expires_at timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  accepted_at       timestamptz,
  revoked_at        timestamptz,
  -- A pending row has a code and no guardian; an active one has a guardian and
  -- no code. Written as a constraint because "the code is cleared on accept"
  -- is the kind of thing that is true until somebody adds a second code path.
  CONSTRAINT ivx_guardian_shape CHECK (
    (status = 'pending' AND guardian_user_id IS NULL AND invite_code IS NOT NULL)
    OR (status = 'active' AND guardian_user_id IS NOT NULL AND invite_code IS NULL)
    OR (status = 'revoked')
  ),
  CONSTRAINT ivx_guardian_not_self CHECK (guardian_user_id IS NULL OR guardian_user_id <> student_user_id)
);

-- One active guardian row per pair: accepting twice should not double the list.
CREATE UNIQUE INDEX IF NOT EXISTS ivx_guardians_active_pair_idx
  ON public.ivx_guardians(student_user_id, guardian_user_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS ivx_guardians_guardian_idx
  ON public.ivx_guardians(guardian_user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS ivx_guardians_student_idx
  ON public.ivx_guardians(student_user_id);

COMMENT ON TABLE public.ivx_guardians IS
  'Who may see a student''s IVX progress. Issued by the student with a single-use code; either side can revoke. Writes go through the definer functions only — a client that could insert here could grant itself a view of somebody else''s child.';

ALTER TABLE public.ivx_guardians ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Both sides read the link they are part of. Neither writes: an INSERT
  -- policy on this table is a way to appoint yourself somebody's guardian.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ivx_guardians' AND policyname = 'ivx_guardians_own_side'
  ) THEN
    CREATE POLICY "ivx_guardians_own_side" ON public.ivx_guardians
      FOR SELECT USING (
        (select auth.uid()) = student_user_id OR (select auth.uid()) = guardian_user_id
      );
  END IF;
END $$;

GRANT SELECT ON public.ivx_guardians TO authenticated;
GRANT ALL    ON public.ivx_guardians TO service_role;

-- ── Invite codes ────────────────────────────────────────────────────────────
--
-- Ten characters from an alphabet with no 0/O and no 1/I/l, because this code
-- is read out loud down a phone and typed by somebody who may be doing it with
-- a screen reader. Case-insensitive on redemption for the same reason.

CREATE OR REPLACE FUNCTION public.ivx_guardian_code()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  SELECT string_agg(
    substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::integer, 1),
    ''
  )
  FROM generate_series(1, 10);
$$;

/**
 * Invite a parent or a teacher.
 *
 * The student calls this about themselves — there is no student argument, so
 * there is nothing to point at somebody else.
 */
CREATE OR REPLACE FUNCTION public.ivx_guardian_invite(
  _relation text DEFAULT 'parent',
  _label    text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _student uuid := (select auth.uid());
  _code    text;
  _open    integer;
BEGIN
  IF _student IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF COALESCE(_relation, '') NOT IN ('parent','teacher') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown_relation');
  END IF;

  -- A cap on unredeemed invitations. Without one, a compromised session could
  -- mint codes indefinitely and every one of them is a standing offer.
  SELECT count(*) INTO _open
    FROM public.ivx_guardians
   WHERE student_user_id = _student AND status = 'pending'
     AND invite_expires_at > now();
  IF _open >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_many_pending');
  END IF;

  LOOP
    _code := public.ivx_guardian_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.ivx_guardians WHERE invite_code = _code);
  END LOOP;

  INSERT INTO public.ivx_guardians
    (student_user_id, relation, label, status, invite_code, invite_expires_at)
  VALUES
    (_student, _relation, left(COALESCE(_label, ''), 60), 'pending', _code, now() + interval '7 days');

  RETURN jsonb_build_object('ok', true, 'code', _code, 'expires_at', now() + interval '7 days');
END;
$$;

/**
 * Redeem a code.
 *
 * Single use, seven days, and it cannot be redeemed by the student who issued
 * it — a self-link would be a way to hold a "guardian" view of your own
 * account, which is only ever useful for testing and confusing everywhere else.
 */
CREATE OR REPLACE FUNCTION public.ivx_guardian_accept(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _guardian uuid := (select auth.uid());
  _row      public.ivx_guardians%ROWTYPE;
BEGIN
  IF _guardian IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO _row
    FROM public.ivx_guardians
   WHERE invite_code = upper(btrim(COALESCE(_code, '')))
     AND status = 'pending'
   FOR UPDATE;

  -- One reason for every failure a stranger could probe with: an expired code
  -- and an invented code answer the same way, so redemption cannot be used to
  -- discover which codes exist.
  IF _row.id IS NULL OR _row.invite_expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_code');
  END IF;
  IF _row.student_user_id = _guardian THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_code');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ivx_guardians
     WHERE student_user_id = _row.student_user_id
       AND guardian_user_id = _guardian AND status = 'active'
  ) THEN
    -- Already watching. Burn the code anyway: it has been used.
    UPDATE public.ivx_guardians
       SET status = 'revoked', invite_code = NULL, revoked_at = now()
     WHERE id = _row.id;
    RETURN jsonb_build_object('ok', true, 'already', true);
  END IF;

  UPDATE public.ivx_guardians
     SET guardian_user_id = _guardian,
         status = 'active',
         invite_code = NULL,
         invite_expires_at = NULL,
         accepted_at = now()
   WHERE id = _row.id;

  RETURN jsonb_build_object('ok', true, 'already', false, 'relation', _row.relation);
END;
$$;

/**
 * End a link.
 *
 * Either side, without asking the other, and immediately. A student who wants
 * to stop being watched should not have to negotiate it.
 */
CREATE OR REPLACE FUNCTION public.ivx_guardian_revoke(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me      uuid := (select auth.uid());
  _touched integer;
BEGIN
  IF _me IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  UPDATE public.ivx_guardians
     SET status = 'revoked', invite_code = NULL, invite_expires_at = NULL, revoked_at = now()
   WHERE id = _id
     AND status <> 'revoked'
     AND (student_user_id = _me OR guardian_user_id = _me);

  GET DIAGNOSTICS _touched = ROW_COUNT;
  IF _touched = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

/**
 * What the student sees: who is watching, and what is still outstanding.
 *
 * A pending invitation shows its code, because the student may need to read it
 * out again — it is their own code, and they are the only one who can see it.
 */
CREATE OR REPLACE FUNCTION public.ivx_guardian_links()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _student uuid := (select auth.uid());
BEGIN
  IF _student IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'links', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', g.id,
               'relation', g.relation,
               'label', g.label,
               'status', g.status,
               'code', CASE WHEN g.status = 'pending' AND g.invite_expires_at > now()
                            THEN g.invite_code END,
               'expires_at', g.invite_expires_at,
               -- The guardian's own Academy name, which they published. Never
               -- their email: a link is not a way to learn somebody's address.
               'guardian_name', (SELECT p.name FROM public.academy_profiles p
                                  WHERE p.user_id = g.guardian_user_id),
               'accepted_at', g.accepted_at
             ) ORDER BY g.created_at DESC)
        FROM public.ivx_guardians g
       WHERE g.student_user_id = _student AND g.status <> 'revoked'
    ), '[]'::jsonb)
  );
END;
$$;

/** The students a guardian may look at. */
CREATE OR REPLACE FUNCTION public.ivx_guardian_students()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _guardian uuid := (select auth.uid());
BEGIN
  IF _guardian IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'students', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'link_id', g.id,
               'student_id', g.student_user_id,
               'name', COALESCE(NULLIF(p.name, ''), ''),
               'relation', g.relation,
               'xp', COALESCE(p.xp_total, 0),
               'streak_days', COALESCE(p.streak_days, 0),
               'last_practised_at', (SELECT max(a.created_at) FROM public.ivx_attempts a
                                      WHERE a.user_id = g.student_user_id)
             ) ORDER BY p.name)
        FROM public.ivx_guardians g
        LEFT JOIN public.academy_profiles p ON p.user_id = g.student_user_id
       WHERE g.guardian_user_id = _guardian AND g.status = 'active'
    ), '[]'::jsonb)
  );
END;
$$;

/**
 * One student's practice, for a guardian.
 *
 * The projection is the privacy boundary, so it is written out in full rather
 * than selecting from a view: mastery, counts and dates, and the skills that
 * are struggling. No typed answers, no tutoring turns, nothing from outside
 * IVX. Adding a field here is a decision about somebody's child, not a tweak.
 */
CREATE OR REPLACE FUNCTION public.ivx_guardian_progress(
  _student_id uuid,
  _language   text DEFAULT 'en'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _guardian uuid := (select auth.uid());
BEGIN
  IF _guardian IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  -- The link is checked first and separately. Reading it out of a join would
  -- make "is this person allowed" a property of a query somebody might later
  -- rewrite for performance.
  IF NOT EXISTS (
    SELECT 1 FROM public.ivx_guardians
     WHERE guardian_user_id = _guardian
       AND student_user_id = _student_id
       AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_linked');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'student_id', _student_id,
    'name', COALESCE((SELECT NULLIF(name, '') FROM public.academy_profiles WHERE user_id = _student_id), ''),
    'xp', COALESCE((SELECT xp_total FROM public.academy_profiles WHERE user_id = _student_id), 0),
    'streak_days', COALESCE((SELECT streak_days FROM public.academy_profiles WHERE user_id = _student_id), 0),
    'attempts_30d', (SELECT count(*) FROM public.ivx_attempts
                      WHERE user_id = _student_id AND created_at > now() - interval '30 days'),
    'correct_30d', (SELECT count(*) FROM public.ivx_attempts
                     WHERE user_id = _student_id AND is_correct
                       AND created_at > now() - interval '30 days'),
    'last_practised_at', (SELECT max(created_at) FROM public.ivx_attempts WHERE user_id = _student_id),
    'subjects', COALESCE((
      SELECT jsonb_agg(x ORDER BY x ->> 'sort')
        FROM (
          SELECT jsonb_build_object(
                   'slug', s.slug,
                   'title', public.ivx_text(s.title, _language),
                   'sort', lpad(s.sort_order::text, 5, '0'),
                   'skills_total', (SELECT count(*) FROM public.ivx_skills k
                                     WHERE k.subject_slug = s.slug AND k.is_active),
                   'skills_started', (SELECT count(*) FROM public.ivx_mastery m
                                        JOIN public.ivx_skills k ON k.slug = m.skill_slug
                                       WHERE m.user_id = _student_id AND k.subject_slug = s.slug),
                   'skills_mastered', (SELECT count(*) FROM public.ivx_mastery m
                                         JOIN public.ivx_skills k ON k.slug = m.skill_slug
                                        WHERE m.user_id = _student_id AND k.subject_slug = s.slug
                                          AND m.state = 'mastered')
                 ) AS x
            FROM public.ivx_subjects s WHERE s.is_active
        ) t
    ), '[]'::jsonb),
    -- Where help would land. A skill practised recently, not mastered, and
    -- going wrong more often than right — that is a sentence a parent can act
    -- on, and it needs none of the student's working to say.
    'struggling', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'skill', m.skill_slug,
               'title', public.ivx_text(k.title, _language),
               'subject', k.subject_slug,
               'state', m.state,
               'score', m.score,
               'attempts', m.attempts,
               'correct', m.correct
             ) ORDER BY m.score)
        FROM public.ivx_mastery m
        JOIN public.ivx_skills k ON k.slug = m.skill_slug
       WHERE m.user_id = _student_id
         AND m.state <> 'mastered'
         AND m.attempts >= 3
         AND m.correct * 2 < m.attempts
         AND m.last_seen_at > now() - interval '30 days'
    ), '[]'::jsonb),
    'mastered', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'skill', m.skill_slug,
               'title', public.ivx_text(k.title, _language),
               'subject', k.subject_slug,
               'at', m.last_seen_at
             ) ORDER BY m.last_seen_at DESC)
        FROM public.ivx_mastery m
        JOIN public.ivx_skills k ON k.slug = m.skill_slug
       WHERE m.user_id = _student_id AND m.state = 'mastered'
    ), '[]'::jsonb)
  );
END;
$$;

-- ── Permissions ─────────────────────────────────────────────────────────────
--
-- All six are called by a logged-in browser and all six derive the caller from
-- `auth.uid()`. `ivx_guardian_progress` is the only one that takes an id, and
-- it is the id of the person being *looked at* — checked against an active
-- link before anything is read.

DO $$
DECLARE _fn text;
BEGIN
  FOREACH _fn IN ARRAY ARRAY[
    'public.ivx_guardian_invite(text, text)',
    'public.ivx_guardian_accept(text)',
    'public.ivx_guardian_revoke(uuid)',
    'public.ivx_guardian_links()',
    'public.ivx_guardian_students()',
    'public.ivx_guardian_progress(uuid, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', _fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', _fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', _fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', _fn);
  END LOOP;

  -- The code generator is an implementation detail; nothing outside these
  -- functions has any reason to mint one.
  EXECUTE 'REVOKE ALL ON FUNCTION public.ivx_guardian_code() FROM PUBLIC';
  EXECUTE 'REVOKE ALL ON FUNCTION public.ivx_guardian_code() FROM anon';
  EXECUTE 'REVOKE ALL ON FUNCTION public.ivx_guardian_code() FROM authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.ivx_guardian_code() TO service_role';
END $$;
