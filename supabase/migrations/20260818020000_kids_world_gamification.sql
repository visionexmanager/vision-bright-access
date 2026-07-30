-- ============================================================
-- Migration: VisionKids World (Phase 12) — economy, quests, unlocks, stats.
--
-- Reused, not redefined: award_kids_xp / award_kids_coins CREATE OR REPLACEd
-- with every prior branch preserved verbatim + World reasons appended;
-- spend_vx (the real VX wallet in public.user_points) powers the Marketplace;
-- award_kids_achievement / kids_user_achievements for badges. All value-moving
-- actions go through SECURITY DEFINER RPCs with server-side prices, once-only
-- guards, audit logging, and a simple per-minute rate limit.
-- ============================================================

CREATE OR REPLACE FUNCTION public.award_kids_xp(_amount INTEGER, _reason TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _max_amount INTEGER;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  CASE
    WHEN _reason LIKE 'Story completed:%'      THEN _max_amount := 50;
    WHEN _reason LIKE 'Quiz completed:%'        THEN _max_amount := 30;
    WHEN _reason LIKE 'Reading streak:%'        THEN _max_amount := 50;
    WHEN _reason LIKE 'AI story created:%'      THEN _max_amount := 20;
    WHEN _reason LIKE 'Game completed:%'        THEN _max_amount := 40;
    WHEN _reason LIKE 'Perfect score:%'         THEN _max_amount := 25;
    WHEN _reason LIKE 'Daily challenge:%'       THEN _max_amount := 30;
    WHEN _reason LIKE 'Weekly challenge:%'      THEN _max_amount := 100;
    WHEN _reason LIKE 'Achievement unlocked:%'  THEN _max_amount := 30;
    WHEN _reason LIKE 'Daily login:%'           THEN _max_amount := 15;
    WHEN _reason LIKE 'Lesson completed:%'      THEN _max_amount := 25;
    WHEN _reason LIKE 'Course completed:%'      THEN _max_amount := 150;
    WHEN _reason LIKE 'Homework submitted:%'    THEN _max_amount := 20;
    WHEN _reason LIKE 'Project submitted:%'     THEN _max_amount := 50;
    WHEN _reason LIKE 'Exam passed:%'           THEN _max_amount := 80;
    WHEN _reason LIKE 'Creative project saved:%' THEN _max_amount := 20;
    WHEN _reason LIKE 'Creative challenge submitted:%' THEN _max_amount := 40;
    WHEN _reason LIKE 'World explored:%'        THEN _max_amount := 20;
    WHEN _reason LIKE 'Location quiz completed:%' THEN _max_amount := 20;
    WHEN _reason LIKE 'Simulator milestone:%'   THEN _max_amount := 30;
    WHEN _reason LIKE 'Explorer certificate:%'  THEN _max_amount := 100;
    WHEN _reason LIKE 'Friend added:%'          THEN _max_amount := 10;
    WHEN _reason LIKE 'Club joined:%'           THEN _max_amount := 15;
    WHEN _reason LIKE 'Group quiz completed:%'  THEN _max_amount := 25;
    WHEN _reason LIKE 'Group assignment submitted:%' THEN _max_amount := 20;
    WHEN _reason LIKE 'Social challenge won:%'  THEN _max_amount := 80;
    WHEN _reason LIKE 'Social challenge joined:%' THEN _max_amount := 10;
    WHEN _reason LIKE 'Event registered:%'      THEN _max_amount := 10;
    WHEN _reason LIKE 'Event attended:%'        THEN _max_amount := 40;
    WHEN _reason LIKE 'Workshop completed:%'    THEN _max_amount := 35;
    WHEN _reason LIKE 'Competition entered:%'   THEN _max_amount := 30;
    WHEN _reason LIKE 'Competition won:%'       THEN _max_amount := 100;
    WHEN _reason LIKE 'City visited:%'          THEN _max_amount := 15;
    WHEN _reason LIKE 'Event certificate:%'     THEN _max_amount := 60;
    WHEN _reason LIKE 'Talent assessment:%'     THEN _max_amount := 30;
    WHEN _reason LIKE 'Skill mastered:%'        THEN _max_amount := 60;
    WHEN _reason LIKE 'Module completed:%'      THEN _max_amount := 60;
    WHEN _reason LIKE 'Track completed:%'       THEN _max_amount := 150;
    WHEN _reason LIKE 'Innovation challenge:%'  THEN _max_amount := 60;
    WHEN _reason LIKE 'Talent certificate:%'    THEN _max_amount := 100;
    -- Phase 10 — Health & Wellness
    WHEN _reason LIKE 'Habit completed:%'       THEN _max_amount := 20;
    WHEN _reason LIKE 'Routine completed:%'     THEN _max_amount := 20;
    WHEN _reason LIKE 'Mood logged:%'           THEN _max_amount := 15;
    WHEN _reason LIKE 'Sleep logged:%'          THEN _max_amount := 15;
    WHEN _reason LIKE 'Mindfulness session:%'   THEN _max_amount := 20;
    WHEN _reason LIKE 'Exercise session:%'      THEN _max_amount := 20;
    WHEN _reason LIKE 'Healthy challenge:%'     THEN _max_amount := 40;
    WHEN _reason LIKE 'Healthy streak:%'        THEN _max_amount := 60;
    -- Phase 11 — STEM & Innovation Center
    WHEN _reason LIKE 'Experiment completed:%'  THEN _max_amount := 60;
    WHEN _reason LIKE 'Experiment quiz:%'       THEN _max_amount := 30;
    WHEN _reason LIKE 'Invention saved:%'       THEN _max_amount := 20;
    WHEN _reason LIKE 'Robot programmed:%'      THEN _max_amount := 30;
    WHEN _reason LIKE 'Design created:%'        THEN _max_amount := 20;
    WHEN _reason LIKE 'Innovation submitted:%'  THEN _max_amount := 60;
    WHEN _reason LIKE 'Research read:%'         THEN _max_amount := 15;
    WHEN _reason LIKE 'STEM streak:%'           THEN _max_amount := 60;
    -- Phase 12 — VisionKids World
    WHEN _reason LIKE 'World quest:%'           THEN _max_amount := 60;
    WHEN _reason LIKE 'Region visited:%'        THEN _max_amount := 15;
    WHEN _reason LIKE 'Transport unlocked:%'    THEN _max_amount := 20;
    WHEN _reason LIKE 'Home decorated:%'        THEN _max_amount := 15;
    ELSE RAISE EXCEPTION 'Invalid reason: %', _reason;
  END CASE;

  IF _amount > _max_amount THEN RAISE EXCEPTION 'Amount exceeds maximum (%) for reason: %', _max_amount, _reason; END IF;

  INSERT INTO public.user_points(user_id, points, reason) VALUES (_user_id, _amount, _reason);
  INSERT INTO public.kids_xp_events(user_id, amount, reason) VALUES (_user_id, _amount, _reason);
END;
$$;

CREATE OR REPLACE FUNCTION public.award_kids_coins(_amount INTEGER, _reason TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _max_amount INTEGER;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  CASE
    WHEN _reason LIKE 'Game completed:%'      THEN _max_amount := 20;
    WHEN _reason LIKE 'Daily challenge:%'     THEN _max_amount := 15;
    WHEN _reason LIKE 'Weekly challenge:%'    THEN _max_amount := 50;
    WHEN _reason LIKE 'Daily login:%'         THEN _max_amount := 10;
    WHEN _reason LIKE 'Lesson completed:%'    THEN _max_amount := 15;
    WHEN _reason LIKE 'Course completed:%'    THEN _max_amount := 75;
    WHEN _reason LIKE 'Homework submitted:%'  THEN _max_amount := 10;
    WHEN _reason LIKE 'Project submitted:%'   THEN _max_amount := 25;
    WHEN _reason LIKE 'Exam passed:%'         THEN _max_amount := 40;
    WHEN _reason LIKE 'Creative project saved:%' THEN _max_amount := 10;
    WHEN _reason LIKE 'Creative challenge submitted:%' THEN _max_amount := 20;
    WHEN _reason LIKE 'World explored:%'       THEN _max_amount := 10;
    WHEN _reason LIKE 'Location quiz completed:%' THEN _max_amount := 10;
    WHEN _reason LIKE 'Simulator milestone:%'  THEN _max_amount := 15;
    WHEN _reason LIKE 'Explorer certificate:%' THEN _max_amount := 60;
    WHEN _reason LIKE 'Friend added:%'         THEN _max_amount := 5;
    WHEN _reason LIKE 'Club joined:%'          THEN _max_amount := 10;
    WHEN _reason LIKE 'Group quiz completed:%' THEN _max_amount := 15;
    WHEN _reason LIKE 'Group assignment submitted:%' THEN _max_amount := 10;
    WHEN _reason LIKE 'Social challenge won:%' THEN _max_amount := 40;
    WHEN _reason LIKE 'Social challenge joined:%' THEN _max_amount := 5;
    WHEN _reason LIKE 'Event registered:%'     THEN _max_amount := 5;
    WHEN _reason LIKE 'Event attended:%'       THEN _max_amount := 20;
    WHEN _reason LIKE 'Workshop completed:%'   THEN _max_amount := 18;
    WHEN _reason LIKE 'Competition entered:%'  THEN _max_amount := 15;
    WHEN _reason LIKE 'Competition won:%'      THEN _max_amount := 50;
    WHEN _reason LIKE 'City visited:%'         THEN _max_amount := 8;
    WHEN _reason LIKE 'Event certificate:%'    THEN _max_amount := 30;
    WHEN _reason LIKE 'Talent assessment:%'    THEN _max_amount := 15;
    WHEN _reason LIKE 'Skill mastered:%'       THEN _max_amount := 30;
    WHEN _reason LIKE 'Module completed:%'     THEN _max_amount := 30;
    WHEN _reason LIKE 'Track completed:%'      THEN _max_amount := 75;
    WHEN _reason LIKE 'Innovation challenge:%' THEN _max_amount := 30;
    WHEN _reason LIKE 'Talent certificate:%'   THEN _max_amount := 60;
    -- Phase 10 — Health & Wellness
    WHEN _reason LIKE 'Habit completed:%'      THEN _max_amount := 10;
    WHEN _reason LIKE 'Routine completed:%'    THEN _max_amount := 10;
    WHEN _reason LIKE 'Mood logged:%'          THEN _max_amount := 8;
    WHEN _reason LIKE 'Sleep logged:%'         THEN _max_amount := 8;
    WHEN _reason LIKE 'Mindfulness session:%'  THEN _max_amount := 10;
    WHEN _reason LIKE 'Exercise session:%'     THEN _max_amount := 10;
    WHEN _reason LIKE 'Healthy challenge:%'    THEN _max_amount := 20;
    WHEN _reason LIKE 'Healthy streak:%'       THEN _max_amount := 30;
    -- Phase 11 — STEM & Innovation Center
    WHEN _reason LIKE 'Experiment completed:%' THEN _max_amount := 30;
    WHEN _reason LIKE 'Experiment quiz:%'      THEN _max_amount := 15;
    WHEN _reason LIKE 'Invention saved:%'      THEN _max_amount := 10;
    WHEN _reason LIKE 'Robot programmed:%'     THEN _max_amount := 15;
    WHEN _reason LIKE 'Design created:%'       THEN _max_amount := 10;
    WHEN _reason LIKE 'Innovation submitted:%' THEN _max_amount := 30;
    WHEN _reason LIKE 'Research read:%'        THEN _max_amount := 8;
    WHEN _reason LIKE 'STEM streak:%'          THEN _max_amount := 30;
    -- Phase 12 — VisionKids World
    WHEN _reason LIKE 'World quest:%'          THEN _max_amount := 40;
    WHEN _reason LIKE 'Region visited:%'       THEN _max_amount := 10;
    WHEN _reason LIKE 'Home decorated:%'       THEN _max_amount := 8;
    ELSE RAISE EXCEPTION 'Invalid reason: %', _reason;
  END CASE;

  IF _amount > _max_amount THEN RAISE EXCEPTION 'Amount exceeds maximum (%) for reason: %', _max_amount, _reason; END IF;

  INSERT INTO public.user_points(user_id, points, reason) VALUES (_user_id, _amount, _reason);
END;
$$;

-- ── Helpers ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.kids_has_achievement(_user_id UUID, _key TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.kids_user_achievements ua
    JOIN public.kids_achievements a ON a.id = ua.achievement_id
    WHERE ua.user_id = _user_id AND a.key = _key
  );
$$;

-- Simple per-minute rate limiter using the audit log. Raises if the caller has
-- logged more than _max rows for _action in the last minute.
CREATE OR REPLACE FUNCTION public.kids_world_rate_ok(_action TEXT, _max INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _n INTEGER;
BEGIN
  SELECT count(*) INTO _n FROM public.kids_world_audit
  WHERE user_id = auth.uid() AND action = _action AND created_at > now() - interval '1 minute';
  RETURN _n < _max;
END;
$$;

-- ============================================================
-- buy_kids_item — purchase a Marketplace item with VX coins. Server-side price
-- (never trusts the client), one-per-child ownership, rate-limited, audited.
-- Calls the existing spend_vx (which enforces the wallet balance). Returns
-- { ok, balance_after }.
-- ============================================================
CREATE OR REPLACE FUNCTION public.buy_kids_item(_item_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _item public.kids_marketplace_items%ROWTYPE;
  _balance BIGINT;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  IF NOT public.kids_world_rate_ok('purchase', 30) THEN RAISE EXCEPTION 'Too many purchases — please slow down'; END IF;

  SELECT * INTO _item FROM public.kids_marketplace_items WHERE slug = _item_slug AND status = 'published';
  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found'; END IF;

  IF EXISTS (SELECT 1 FROM public.kids_world_inventory WHERE user_id = _user_id AND item_slug = _item_slug) THEN
    RAISE EXCEPTION 'You already own this item';
  END IF;

  -- Spend from the real VX wallet (raises on insufficient balance).
  PERFORM public.spend_vx(_item.price_coins, 'kids_marketplace', _item.slug, _item.title);

  INSERT INTO public.kids_world_inventory (user_id, item_slug, category)
  VALUES (_user_id, _item_slug, _item.category);

  INSERT INTO public.kids_world_audit (user_id, action, detail)
  VALUES (_user_id, 'purchase', jsonb_build_object('item', _item_slug, 'price', _item.price_coins));

  SELECT COALESCE(SUM(points), 0) INTO _balance FROM public.user_points WHERE user_id = _user_id;
  RETURN jsonb_build_object('ok', true, 'balance_after', _balance);
END;
$$;

GRANT EXECUTE ON FUNCTION public.buy_kids_item(TEXT) TO authenticated;

-- ============================================================
-- visit_kids_region — record a region discovery (World Passport stamp).
-- Idempotent; small reward on first-ever visit. Returns TRUE if newly visited.
-- ============================================================
CREATE OR REPLACE FUNCTION public.visit_kids_region(_region_slug TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _newly BOOLEAN;
BEGIN
  IF _user_id IS NULL THEN RETURN FALSE; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.kids_world_regions WHERE slug = _region_slug AND status = 'published') THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.kids_region_visits (user_id, region_slug)
  VALUES (_user_id, _region_slug)
  ON CONFLICT (user_id, region_slug) DO NOTHING;
  _newly := FOUND;

  IF _newly THEN
    PERFORM public.award_kids_xp(10, 'Region visited: ' || _region_slug);
    PERFORM public.award_kids_coins(5, 'Region visited: ' || _region_slug);
    -- Explorer badge after discovering 5 regions.
    IF (SELECT count(*) FROM public.kids_region_visits WHERE user_id = _user_id) >= 5 THEN
      PERFORM public.award_kids_achievement('world_explorer');
    END IF;
  END IF;

  RETURN _newly;
END;
$$;

GRANT EXECUTE ON FUNCTION public.visit_kids_region(TEXT) TO authenticated;

-- ============================================================
-- complete_kids_world_quest — complete a world activity/quest for its current
-- period window (daily/weekly/seasonal/anytime). Idempotent per window; rewards
-- once per window. Returns { newly_completed, period_start }.
-- ============================================================
CREATE OR REPLACE FUNCTION public.complete_kids_world_quest(_activity_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _act public.kids_world_activities%ROWTYPE;
  _period DATE;
  _existed BOOLEAN;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;

  SELECT * INTO _act FROM public.kids_world_activities WHERE id = _activity_id AND status = 'published';
  IF NOT FOUND THEN RAISE EXCEPTION 'Activity not found'; END IF;

  _period := CASE _act.cadence
    WHEN 'weekly'   THEN date_trunc('week', CURRENT_DATE)::date
    WHEN 'seasonal' THEN date_trunc('quarter', CURRENT_DATE)::date
    WHEN 'daily'    THEN CURRENT_DATE
    ELSE DATE '2000-01-01' END; -- 'anytime' => single lifetime window

  SELECT EXISTS (
    SELECT 1 FROM public.kids_quest_progress
    WHERE user_id = _user_id AND activity_id = _activity_id AND period_start = _period AND status = 'completed'
  ) INTO _existed;

  INSERT INTO public.kids_quest_progress (user_id, activity_id, period_start, status, completed_at)
  VALUES (_user_id, _activity_id, _period, 'completed', now())
  ON CONFLICT (user_id, activity_id, period_start) DO UPDATE
    SET status = 'completed', completed_at = COALESCE(public.kids_quest_progress.completed_at, now());

  IF NOT _existed THEN
    IF _act.reward_xp > 0 THEN PERFORM public.award_kids_xp(_act.reward_xp, 'World quest: ' || _act.region || '/' || _act.slug); END IF;
    IF _act.reward_coins > 0 THEN PERFORM public.award_kids_coins(_act.reward_coins, 'World quest: ' || _act.region || '/' || _act.slug); END IF;
  END IF;

  RETURN jsonb_build_object('newly_completed', NOT _existed, 'period_start', _period);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_kids_world_quest(UUID) TO authenticated;

-- ============================================================
-- unlock_kids_transport — unlock a transport mode once its required achievement
-- is earned (or immediately if it has none). Idempotent. Returns TRUE if newly
-- unlocked, FALSE if already unlocked or requirement not met.
-- ============================================================
CREATE OR REPLACE FUNCTION public.unlock_kids_transport(_transport_slug TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _t public.kids_transportation%ROWTYPE;
  _newly BOOLEAN;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;

  SELECT * INTO _t FROM public.kids_transportation WHERE slug = _transport_slug AND status = 'published';
  IF NOT FOUND THEN RAISE EXCEPTION 'Transport not found'; END IF;

  IF _t.unlock_achievement IS NOT NULL AND NOT public.kids_has_achievement(_user_id, _t.unlock_achievement) THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.kids_transport_unlocks (user_id, transport_slug)
  VALUES (_user_id, _transport_slug)
  ON CONFLICT (user_id, transport_slug) DO NOTHING;
  _newly := FOUND;

  IF _newly THEN
    PERFORM public.award_kids_xp(20, 'Transport unlocked: ' || _transport_slug);
  END IF;

  RETURN _newly;
END;
$$;

GRANT EXECUTE ON FUNCTION public.unlock_kids_transport(TEXT) TO authenticated;

-- ============================================================
-- save_kids_home — upsert the child's home layout. Rate-limited + audited.
-- Rewards 'Home decorated:' once per day (first save of the day). The Builder
-- badge is awarded once a home has any placed items.
-- ============================================================
CREATE OR REPLACE FUNCTION public.save_kids_home(_name TEXT, _theme TEXT, _rooms JSONB)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _clean_name TEXT := btrim(COALESCE(_name, ''));
  _first_today BOOLEAN;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  IF NOT public.kids_world_rate_ok('save_home', 30) THEN RAISE EXCEPTION 'Saving too often — please slow down'; END IF;
  IF length(_clean_name) = 0 THEN _clean_name := 'My Home'; END IF;
  IF length(_clean_name) > 40 THEN RAISE EXCEPTION 'Home name too long'; END IF;
  IF _theme NOT IN ('cozy', 'modern', 'space', 'nature', 'candy') THEN _theme := 'cozy'; END IF;

  SELECT NOT EXISTS (
    SELECT 1 FROM public.kids_world_audit
    WHERE user_id = _user_id AND action = 'save_home' AND created_at::date = CURRENT_DATE
  ) INTO _first_today;

  INSERT INTO public.kids_world_homes (user_id, name, theme, rooms, updated_at)
  VALUES (_user_id, _clean_name, _theme, COALESCE(_rooms, '{}'::jsonb), now())
  ON CONFLICT (user_id) DO UPDATE
    SET name = _clean_name, theme = _theme, rooms = COALESCE(_rooms, '{}'::jsonb), updated_at = now();

  INSERT INTO public.kids_world_audit (user_id, action, detail)
  VALUES (_user_id, 'save_home', jsonb_build_object('theme', _theme));

  IF _first_today THEN
    PERFORM public.award_kids_xp(15, 'Home decorated: ' || CURRENT_DATE::text);
    PERFORM public.award_kids_coins(8, 'Home decorated: ' || CURRENT_DATE::text);
    PERFORM public.award_kids_achievement('world_builder');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_kids_home(TEXT, TEXT, JSONB) TO authenticated;

-- ============================================================
-- get_kids_world_stats — one round-trip for World Home / Passport: VX balance,
-- discovered regions, quests done, items owned, pets, unlocked transports, and
-- earned World badge keys. Reads only the caller's own rows.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_kids_world_stats()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _coins BIGINT := 0;
  _regions INTEGER := 0;
  _quests INTEGER := 0;
  _items INTEGER := 0;
  _pets INTEGER := 0;
  _transports INTEGER := 0;
  _badges TEXT[];
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('coins',0,'regions',0,'quests',0,'items',0,'pets',0,'transports',0,'badges','[]'::jsonb);
  END IF;

  SELECT COALESCE(SUM(points), 0) INTO _coins FROM public.user_points WHERE user_id = _user_id;
  SELECT count(*) INTO _regions FROM public.kids_region_visits WHERE user_id = _user_id;
  SELECT count(*) INTO _quests FROM public.kids_quest_progress WHERE user_id = _user_id AND status = 'completed';
  SELECT count(*) INTO _items FROM public.kids_world_inventory WHERE user_id = _user_id;
  SELECT count(*) INTO _pets FROM public.kids_world_inventory WHERE user_id = _user_id AND category = 'pet';
  SELECT count(*) INTO _transports FROM public.kids_transport_unlocks WHERE user_id = _user_id;
  SELECT COALESCE(array_agg(a.key), '{}') INTO _badges
    FROM public.kids_user_achievements ua
    JOIN public.kids_achievements a ON a.id = ua.achievement_id
    WHERE ua.user_id = _user_id AND a.key LIKE 'world_%';

  RETURN jsonb_build_object(
    'coins', _coins,
    'regions', _regions,
    'quests', _quests,
    'items', _items,
    'pets', _pets,
    'transports', _transports,
    'badges', to_jsonb(_badges)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_kids_world_stats() TO authenticated, anon;

-- ============================================================
-- Seed: VisionKids World achievements (shared kids_achievements table).
-- ============================================================
INSERT INTO public.kids_achievements (key, title, description, icon, reward_vx) VALUES
  ('world_explorer',  'World Explorer',  'Discover 5 regions of the world.',        'Compass',   40),
  ('world_scientist', 'World Scientist', 'Complete a Science City quest.',           'FlaskConical', 30),
  ('world_reader',    'World Reader',    'Complete a Reading Village quest.',        'BookOpen',  30),
  ('world_artist',    'World Artist',    'Create something in the Art District.',    'Palette',   30),
  ('world_musician',  'World Musician',  'Play along in Music Town.',                'Music',     30),
  ('world_inventor',  'World Inventor',  'Launch a mission at the Space Port.',      'Rocket',    40),
  ('world_builder',   'World Builder',   'Decorate your home.',                      'Home',      30),
  ('world_programmer','World Programmer','Solve a puzzle on Coding Island.',         'Code2',     30)
ON CONFLICT (key) DO NOTHING;
