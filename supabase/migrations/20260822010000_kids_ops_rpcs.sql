-- ============================================================
-- Migration: VisionKids AI Ops & Quality (Phase 16) — admin RPCs.
--
-- Every RPC re-checks has_role(auth.uid(),'admin') so the ops console can never
-- be driven by a non-admin, even though the functions are SECURITY DEFINER.
-- Mutations are audited. get_kids_ops_overview aggregates real, platform-owned
-- counts for the Operations Dashboard.
-- ============================================================

CREATE OR REPLACE FUNCTION public.kids_is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin');
$$;
GRANT EXECUTE ON FUNCTION public.kids_is_admin() TO authenticated, anon;

-- ── Operations overview (real counts) ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_kids_ops_overview()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _open_incidents INTEGER := 0; _critical INTEGER := 0;
  _errors INTEGER := 0; _pending_reviews INTEGER := 0;
  _market_pending INTEGER := 0; _active_flags INTEGER := 0;
  _maintenance BOOLEAN := FALSE; _orgs INTEGER := 0; _products INTEGER := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;

  SELECT count(*) FILTER (WHERE status <> 'resolved'), count(*) FILTER (WHERE status <> 'resolved' AND severity = 'critical')
    INTO _open_incidents, _critical FROM public.kids_ops_incidents;
  SELECT count(*) INTO _errors FROM public.kids_ops_error_events WHERE NOT resolved;
  SELECT count(*) INTO _pending_reviews FROM public.kids_ops_reviews WHERE status = 'pending';
  SELECT count(*) INTO _market_pending FROM public.kids_market_products WHERE status = 'pending';
  SELECT count(*) INTO _active_flags FROM public.kids_ops_feature_flags WHERE enabled;
  SELECT enabled INTO _maintenance FROM public.kids_ops_maintenance WHERE id = 1;
  SELECT count(*) INTO _orgs FROM public.kids_organizations;
  SELECT count(*) INTO _products FROM public.kids_market_products WHERE status = 'published';

  RETURN jsonb_build_object(
    'open_incidents', _open_incidents,
    'critical_incidents', _critical,
    'unresolved_errors', _errors,
    'pending_reviews', _pending_reviews + _market_pending,
    'active_flags', _active_flags,
    'maintenance', COALESCE(_maintenance, FALSE),
    'organizations', _orgs,
    'published_products', _products
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_kids_ops_overview() TO authenticated;

-- ── Incidents ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_kids_incident(_title TEXT, _description TEXT, _severity TEXT, _area TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _id UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  INSERT INTO public.kids_ops_incidents (title, description, severity, area, created_by)
  VALUES (btrim(_title), _description, COALESCE(_severity, 'minor'), _area, auth.uid())
  RETURNING id INTO _id;
  INSERT INTO public.kids_ops_audit (actor_id, action, detail) VALUES (auth.uid(), 'incident_create', jsonb_build_object('id', _id));
  RETURN _id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_kids_incident(TEXT, TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_kids_incident(_id UUID, _status TEXT, _assignee UUID DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  UPDATE public.kids_ops_incidents
    SET status = _status,
        assignee_id = COALESCE(_assignee, assignee_id),
        resolved_at = CASE WHEN _status = 'resolved' THEN now() ELSE resolved_at END,
        updated_at = now()
    WHERE id = _id;
  INSERT INTO public.kids_ops_audit (actor_id, action, detail) VALUES (auth.uid(), 'incident_update', jsonb_build_object('id', _id, 'status', _status));
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_kids_incident(UUID, TEXT, UUID) TO authenticated;

-- ── Feature flags ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.toggle_kids_flag(_key TEXT, _enabled BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  UPDATE public.kids_ops_feature_flags SET enabled = _enabled, updated_at = now() WHERE key = _key;
  INSERT INTO public.kids_ops_audit (actor_id, action, detail) VALUES (auth.uid(), 'flag_toggle', jsonb_build_object('key', _key, 'enabled', _enabled));
END;
$$;
GRANT EXECUTE ON FUNCTION public.toggle_kids_flag(TEXT, BOOLEAN) TO authenticated;

-- ── Maintenance mode ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_kids_maintenance(_enabled BOOLEAN, _mode TEXT, _message TEXT, _admins_bypass BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  UPDATE public.kids_ops_maintenance
    SET enabled = _enabled, mode = COALESCE(_mode, 'full'), message = _message,
        admins_bypass = COALESCE(_admins_bypass, TRUE), updated_by = auth.uid(), updated_at = now()
    WHERE id = 1;
  INSERT INTO public.kids_ops_audit (actor_id, action, detail) VALUES (auth.uid(), 'maintenance_set', jsonb_build_object('enabled', _enabled, 'mode', _mode));
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_kids_maintenance(BOOLEAN, TEXT, TEXT, BOOLEAN) TO authenticated;

-- ── Errors ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.resolve_kids_error(_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  UPDATE public.kids_ops_error_events SET resolved = TRUE WHERE id = _id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.resolve_kids_error(UUID) TO authenticated;

-- ── Content review decisions ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.decide_kids_review(_id UUID, _approve BOOLEAN, _notes TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  UPDATE public.kids_ops_reviews
    SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
        reviewer_id = auth.uid(), notes = _notes, updated_at = now()
    WHERE id = _id;
  INSERT INTO public.kids_ops_audit (actor_id, action, detail) VALUES (auth.uid(), 'review_decide', jsonb_build_object('id', _id, 'approved', _approve));
END;
$$;
GRANT EXECUTE ON FUNCTION public.decide_kids_review(UUID, BOOLEAN, TEXT) TO authenticated;
