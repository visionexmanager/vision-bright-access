-- ============================================================
-- Migration: VisionKids Enterprise (Phase 15) — RPCs: org creation, membership,
-- dashboards, analytics, certificate issuance + public QR verification.
--
-- All mutating RPCs are SECURITY DEFINER and re-check org membership/role, so
-- isolation holds even though the functions run as the definer. The one public
-- endpoint, verify_kids_certificate, is granted to anon and returns ONLY the
-- minimal fields printed on a certificate (no ids, no private records).
-- ============================================================

CREATE OR REPLACE FUNCTION public.kids_enterprise_rate_ok(_action TEXT, _max INTEGER)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _n INTEGER;
BEGIN
  SELECT count(*) INTO _n FROM public.kids_enterprise_audit
  WHERE actor_id = auth.uid() AND action = _action AND created_at > now() - interval '1 minute';
  RETURN _n < _max;
END;
$$;

-- ============================================================
-- create_kids_org — create an organization and make the caller its owner.
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_kids_org(_name TEXT, _kind TEXT, _slug TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _org_id UUID;
  _clean_slug TEXT := lower(regexp_replace(coalesce(_slug, ''), '[^a-z0-9]+', '-', 'g'));
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  IF length(btrim(coalesce(_name,''))) = 0 THEN RAISE EXCEPTION 'Name required'; END IF;
  IF _kind NOT IN ('school','nursery','center','library','nonprofit') THEN _kind := 'school'; END IF;
  IF length(_clean_slug) < 2 THEN _clean_slug := 'org-' || substr(gen_random_uuid()::text, 1, 8); END IF;
  IF EXISTS (SELECT 1 FROM public.kids_organizations WHERE slug = _clean_slug) THEN
    _clean_slug := _clean_slug || '-' || substr(gen_random_uuid()::text, 1, 4);
  END IF;

  INSERT INTO public.kids_organizations (slug, name, kind, created_by)
  VALUES (_clean_slug, btrim(_name), _kind, _uid)
  RETURNING id INTO _org_id;

  INSERT INTO public.kids_org_members (org_id, user_id, role, status, display_name)
  VALUES (_org_id, _uid, 'owner', 'active', NULL);

  INSERT INTO public.kids_schools (org_id, name)
  VALUES (_org_id, btrim(_name));

  INSERT INTO public.kids_enterprise_audit (org_id, actor_id, action, detail)
  VALUES (_org_id, _uid, 'create_org', jsonb_build_object('kind', _kind));

  RETURN _org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_kids_org(TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================
-- add_kids_org_member — admin adds/updates a member by user id.
-- ============================================================
CREATE OR REPLACE FUNCTION public.add_kids_org_member(_org UUID, _user_id UUID, _role TEXT, _display_name TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_kids_org_admin(_org, auth.uid()) THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF _role NOT IN ('owner','admin','teacher','parent','student','staff') THEN RAISE EXCEPTION 'Invalid role'; END IF;

  INSERT INTO public.kids_org_members (org_id, user_id, role, status, display_name)
  VALUES (_org, _user_id, _role, 'active', _display_name)
  ON CONFLICT (org_id, user_id) DO UPDATE SET role = _role, display_name = COALESCE(_display_name, public.kids_org_members.display_name);

  INSERT INTO public.kids_enterprise_audit (org_id, actor_id, action, detail)
  VALUES (_org, auth.uid(), 'add_member', jsonb_build_object('user', _user_id, 'role', _role));
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_kids_org_member(UUID, UUID, TEXT, TEXT) TO authenticated;

-- ============================================================
-- mark_kids_attendance — staff upsert a student's attendance for a day.
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_kids_attendance(_class_id UUID, _student_id UUID, _date DATE, _status TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _org UUID;
BEGIN
  SELECT org_id INTO _org FROM public.kids_classes WHERE id = _class_id;
  IF _org IS NULL THEN RAISE EXCEPTION 'Class not found'; END IF;
  IF NOT public.is_kids_org_staff(_org, auth.uid()) THEN RAISE EXCEPTION 'Staff only'; END IF;
  IF _status NOT IN ('present','absent','late','excused') THEN RAISE EXCEPTION 'Invalid status'; END IF;

  INSERT INTO public.kids_attendance (org_id, class_id, student_id, date, status, recorded_by)
  VALUES (_org, _class_id, _student_id, COALESCE(_date, CURRENT_DATE), _status, auth.uid())
  ON CONFLICT (class_id, student_id, date) DO UPDATE SET status = _status, recorded_by = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_kids_attendance(UUID, UUID, DATE, TEXT) TO authenticated;

-- ============================================================
-- issue_kids_certificate — staff issue a QR-verifiable certificate.
-- ============================================================
CREATE OR REPLACE FUNCTION public.issue_kids_certificate(_org UUID, _student_id UUID, _student_name TEXT, _title TEXT, _description TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _id UUID; _code TEXT;
BEGIN
  IF NOT public.is_kids_org_staff(_org, auth.uid()) THEN RAISE EXCEPTION 'Staff only'; END IF;
  IF NOT public.kids_enterprise_rate_ok('issue_cert', 60) THEN RAISE EXCEPTION 'Issuing too fast'; END IF;

  INSERT INTO public.kids_org_certificates (org_id, student_id, student_name, title, description, issued_by, signature)
  VALUES (_org, _student_id, btrim(_student_name), btrim(_title), _description, auth.uid(),
          'VisionKids · ' || to_char(now(), 'YYYY-MM-DD'))
  RETURNING id, verify_code INTO _id, _code;

  INSERT INTO public.kids_enterprise_audit (org_id, actor_id, action, detail)
  VALUES (_org, auth.uid(), 'issue_cert', jsonb_build_object('cert', _id));

  RETURN jsonb_build_object('id', _id, 'verify_code', _code);
END;
$$;

GRANT EXECUTE ON FUNCTION public.issue_kids_certificate(UUID, UUID, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================
-- verify_kids_certificate — PUBLIC QR verification. Returns only the minimal
-- printed fields; never ids or private records. Safe for anon.
-- ============================================================
CREATE OR REPLACE FUNCTION public.verify_kids_certificate(_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE _c RECORD;
BEGIN
  SELECT c.student_name, c.title, c.issued_at, c.status, c.signature, o.name AS org_name
  INTO _c
  FROM public.kids_org_certificates c
  JOIN public.kids_organizations o ON o.id = c.org_id
  WHERE c.verify_code = _code;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false);
  END IF;

  RETURN jsonb_build_object(
    'valid', _c.status = 'valid',
    'status', _c.status,
    'student_name', _c.student_name,
    'title', _c.title,
    'org_name', _c.org_name,
    'issued_at', _c.issued_at,
    'signature', _c.signature
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_kids_certificate(TEXT) TO authenticated, anon;

-- ============================================================
-- get_kids_school_dashboard — live counts for an org's dashboard. Staff-gated.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_kids_school_dashboard(_org UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _students INTEGER := 0; _teachers INTEGER := 0; _classes INTEGER := 0;
  _assignments INTEGER := 0; _present INTEGER := 0; _total_today INTEGER := 0;
  _avg_marks NUMERIC := 0;
BEGIN
  IF NOT public.is_kids_org_staff(_org, auth.uid()) THEN RAISE EXCEPTION 'Staff only'; END IF;

  SELECT count(*) INTO _students FROM public.kids_org_members WHERE org_id = _org AND role = 'student' AND status = 'active';
  SELECT count(*) INTO _teachers FROM public.kids_org_members WHERE org_id = _org AND role = 'teacher' AND status = 'active';
  SELECT count(*) INTO _classes FROM public.kids_classes WHERE org_id = _org;
  SELECT count(*) INTO _assignments FROM public.kids_assignments WHERE org_id = _org;
  SELECT count(*) FILTER (WHERE status = 'present'), count(*)
    INTO _present, _total_today FROM public.kids_attendance WHERE org_id = _org AND date = CURRENT_DATE;
  SELECT COALESCE(round(avg(marks), 1), 0) INTO _avg_marks FROM public.kids_exam_results WHERE org_id = _org;

  RETURN jsonb_build_object(
    'students', _students,
    'teachers', _teachers,
    'classes', _classes,
    'assignments', _assignments,
    'attendance_rate', CASE WHEN _total_today > 0 THEN round(100.0 * _present / _total_today) ELSE 0 END,
    'attendance_marked', _total_today,
    'avg_marks', _avg_marks
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_kids_school_dashboard(UUID) TO authenticated;

-- ============================================================
-- get_kids_org_analytics — richer analytics buckets. Staff-gated.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_kids_org_analytics(_org UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _att_rate NUMERIC := 0; _submissions INTEGER := 0; _graded INTEGER := 0;
  _avg_marks NUMERIC := 0; _certs INTEGER := 0; _resources INTEGER := 0;
BEGIN
  IF NOT public.is_kids_org_staff(_org, auth.uid()) THEN RAISE EXCEPTION 'Staff only'; END IF;

  SELECT CASE WHEN count(*) > 0 THEN round(100.0 * count(*) FILTER (WHERE status = 'present') / count(*)) ELSE 0 END
    INTO _att_rate FROM public.kids_attendance WHERE org_id = _org AND date > CURRENT_DATE - 30;
  SELECT count(*), count(*) FILTER (WHERE status = 'graded')
    INTO _submissions, _graded FROM public.kids_assignment_submissions WHERE org_id = _org;
  SELECT COALESCE(round(avg(marks), 1), 0) INTO _avg_marks FROM public.kids_exam_results WHERE org_id = _org;
  SELECT count(*) INTO _certs FROM public.kids_org_certificates WHERE org_id = _org;
  SELECT count(*) INTO _resources FROM public.kids_org_resources WHERE org_id = _org;

  RETURN jsonb_build_object(
    'attendance_rate_30d', _att_rate,
    'submissions', _submissions,
    'graded', _graded,
    'avg_marks', _avg_marks,
    'certificates', _certs,
    'resources', _resources
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_kids_org_analytics(UUID) TO authenticated;
