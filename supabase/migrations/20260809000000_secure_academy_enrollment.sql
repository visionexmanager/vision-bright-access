-- Secure Academy enrollment.
-- Paid courses previously allowed direct client inserts into academy_enrollments,
-- so a user could bypass price_vx entirely. Enrollment is now atomic and the
-- database is the source of truth for both trial access and VX payment.

DROP POLICY IF EXISTS "academy_enrollments: student manages own"
  ON public.academy_enrollments;

CREATE POLICY "academy_enrollments: student reads own"
  ON public.academy_enrollments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "academy_enrollments: student updates own"
  ON public.academy_enrollments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "academy_enrollments: student deletes own"
  ON public.academy_enrollments FOR DELETE
  USING (auth.uid() = user_id);

-- Keep progress updates working while preventing a user from changing the
-- protected user_id/course_id pair to jump into a different paid course.
REVOKE UPDATE ON public.academy_enrollments FROM authenticated;
GRANT UPDATE (
  progress_percent,
  completed_at,
  current_lesson_id,
  last_position_seconds
) ON public.academy_enrollments TO authenticated;

CREATE OR REPLACE FUNCTION public.academy_enroll_course(_course_id uuid)
RETURNS public.academy_enrollments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _course public.academy_courses%ROWTYPE;
  _enrollment public.academy_enrollments%ROWTYPE;
  _trial_active boolean := false;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Serialize enrollment for this user/course pair so simultaneous requests
  -- cannot charge twice before the unique constraint is observed.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(_user_id::text || ':' || _course_id::text, 0)
  );

  SELECT * INTO _enrollment
  FROM public.academy_enrollments
  WHERE user_id = _user_id AND course_id = _course_id;

  IF FOUND THEN
    RETURN _enrollment;
  END IF;

  SELECT * INTO _course
  FROM public.academy_courses
  WHERE id = _course_id AND status = 'published';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Course not found or unavailable';
  END IF;

  SELECT COALESCE(is_in_trial AND trial_ends_at > now(), false)
  INTO _trial_active
  FROM public.users_billing
  WHERE user_id = _user_id;

  IF NOT _course.is_free AND NOT _trial_active THEN
    IF COALESCE(_course.price_vx, 0) <= 0 THEN
      RAISE EXCEPTION 'Paid course price is not configured';
    END IF;

    PERFORM public.spend_vx(
      _course.price_vx,
      'academy_course',
      _course.id::text,
      _course.title
    );
  END IF;

  INSERT INTO public.academy_enrollments (user_id, course_id)
  VALUES (_user_id, _course_id)
  RETURNING * INTO _enrollment;

  RETURN _enrollment;
END;
$$;

REVOKE ALL ON FUNCTION public.academy_enroll_course(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.academy_enroll_course(uuid) TO authenticated;
