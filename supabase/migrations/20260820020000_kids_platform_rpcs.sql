-- ============================================================
-- Migration: VisionKids Platform Core (Phase 14) — install/config RPCs.
--
-- All state changes go through SECURITY DEFINER RPCs so installs grant only a
-- plugin's DECLARED permissions (permission isolation), everything is audited,
-- and calls are rate-limited. Nothing here executes plugin code — installing
-- toggles a built-in module's availability for the child.
-- ============================================================

CREATE OR REPLACE FUNCTION public.kids_platform_rate_ok(_action TEXT, _max INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE _n INTEGER;
BEGIN
  SELECT count(*) INTO _n FROM public.kids_platform_audit
  WHERE user_id = auth.uid() AND action = _action AND created_at > now() - interval '1 minute';
  RETURN _n < _max;
END;
$$;

-- ============================================================
-- install_kids_plugin — enable an optional plugin for the caller, granting only
-- the plugin's declared permissions. Core plugins are always on (rejected here).
-- ============================================================
CREATE OR REPLACE FUNCTION public.install_kids_plugin(_slug TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _p public.kids_plugins%ROWTYPE;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  IF NOT public.kids_platform_rate_ok('install', 30) THEN RAISE EXCEPTION 'Too many changes — please slow down'; END IF;

  SELECT * INTO _p FROM public.kids_plugins WHERE slug = _slug AND status = 'published';
  IF NOT FOUND THEN RAISE EXCEPTION 'Plugin not found'; END IF;
  IF _p.is_core THEN RAISE EXCEPTION 'Core plugins are always installed'; END IF;

  INSERT INTO public.kids_plugin_installs (user_id, plugin_slug, enabled, granted_permissions, updated_at)
  VALUES (_user_id, _slug, TRUE, _p.permissions, now())
  ON CONFLICT (user_id, plugin_slug) DO UPDATE
    SET enabled = TRUE, granted_permissions = _p.permissions, updated_at = now();

  INSERT INTO public.kids_platform_audit (user_id, action, detail)
  VALUES (_user_id, 'install', jsonb_build_object('plugin', _slug, 'permissions', _p.permissions));
END;
$$;

GRANT EXECUTE ON FUNCTION public.install_kids_plugin(TEXT) TO authenticated;

-- ============================================================
-- uninstall_kids_plugin — remove an optional plugin (and its granted perms).
-- ============================================================
CREATE OR REPLACE FUNCTION public.uninstall_kids_plugin(_slug TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _user_id UUID := auth.uid();
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  DELETE FROM public.kids_plugin_installs WHERE user_id = _user_id AND plugin_slug = _slug;
  INSERT INTO public.kids_platform_audit (user_id, action, detail)
  VALUES (_user_id, 'uninstall', jsonb_build_object('plugin', _slug));
END;
$$;

GRANT EXECUTE ON FUNCTION public.uninstall_kids_plugin(TEXT) TO authenticated;

-- ============================================================
-- toggle_kids_plugin — enable/disable an already-installed plugin.
-- ============================================================
CREATE OR REPLACE FUNCTION public.toggle_kids_plugin(_slug TEXT, _enabled BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  UPDATE public.kids_plugin_installs SET enabled = _enabled, updated_at = now()
  WHERE user_id = auth.uid() AND plugin_slug = _slug;
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_kids_plugin(TEXT, BOOLEAN) TO authenticated;

-- ============================================================
-- set_kids_dashboard — replace the caller's dashboard layout with an ordered
-- list of widget slugs. `_widgets` is a JSONB array of slug strings; unknown
-- slugs are ignored. Rewrites the layout atomically.
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_kids_dashboard(_widgets JSONB)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _slug TEXT;
  _pos INTEGER := 0;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  IF jsonb_typeof(_widgets) <> 'array' THEN RAISE EXCEPTION 'Widgets must be an array'; END IF;
  IF jsonb_array_length(_widgets) > 30 THEN RAISE EXCEPTION 'Too many widgets'; END IF;

  DELETE FROM public.kids_dashboard_widgets WHERE user_id = _user_id;

  FOR _slug IN SELECT jsonb_array_elements_text(_widgets) LOOP
    IF EXISTS (SELECT 1 FROM public.kids_widgets WHERE slug = _slug AND status = 'published') THEN
      INSERT INTO public.kids_dashboard_widgets (user_id, widget_slug, position, enabled, updated_at)
      VALUES (_user_id, _slug, _pos, TRUE, now())
      ON CONFLICT (user_id, widget_slug) DO UPDATE SET position = _pos, enabled = TRUE, updated_at = now();
      _pos := _pos + 1;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_kids_dashboard(JSONB) TO authenticated;

-- ============================================================
-- set_kids_theme — choose a theme (persisted; the client Theme Engine applies).
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_kids_theme(_slug TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _user_id UUID := auth.uid();
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.kids_themes WHERE slug = _slug AND status = 'published') THEN
    RAISE EXCEPTION 'Theme not found';
  END IF;
  INSERT INTO public.kids_theme_prefs (user_id, theme_slug, updated_at)
  VALUES (_user_id, _slug, now())
  ON CONFLICT (user_id) DO UPDATE SET theme_slug = _slug, updated_at = now();
  INSERT INTO public.kids_platform_audit (user_id, action, detail)
  VALUES (_user_id, 'theme', jsonb_build_object('theme', _slug));
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_kids_theme(TEXT) TO authenticated;

-- ============================================================
-- mark_kids_notification_read — mark one (or all, when _id is NULL) as read.
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_kids_notification_read(_id UUID DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  IF _id IS NULL THEN
    UPDATE public.kids_notifications SET read = TRUE WHERE user_id = auth.uid() AND NOT read;
  ELSE
    UPDATE public.kids_notifications SET read = TRUE WHERE user_id = auth.uid() AND id = _id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_kids_notification_read(UUID) TO authenticated;

-- ============================================================
-- get_kids_platform_stats — one round-trip for the Platform Hub: installed
-- optional plugins, dashboard widget count, unread notifications, current theme.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_kids_platform_stats()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _installed INTEGER := 0; _widgets INTEGER := 0; _unread INTEGER := 0; _theme TEXT := 'kids';
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('installed',0,'widgets',0,'unread',0,'theme','kids');
  END IF;
  SELECT count(*) INTO _installed FROM public.kids_plugin_installs WHERE user_id = _uid AND enabled;
  SELECT count(*) INTO _widgets FROM public.kids_dashboard_widgets WHERE user_id = _uid AND enabled;
  SELECT count(*) INTO _unread FROM public.kids_notifications WHERE user_id = _uid AND NOT read;
  SELECT theme_slug INTO _theme FROM public.kids_theme_prefs WHERE user_id = _uid;
  RETURN jsonb_build_object('installed', _installed, 'widgets', _widgets, 'unread', _unread, 'theme', COALESCE(_theme, 'kids'));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_kids_platform_stats() TO authenticated, anon;
