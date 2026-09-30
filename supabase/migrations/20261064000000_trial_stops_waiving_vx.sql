-- The free week stops waiving VX on things it does not include.
--
-- Two functions charged nothing to an account inside its free week, which was
-- the "every section is open" rule expressed as a price: a flagship VXBazaar
-- shop (150,000 VX) and every paid Academy course were free for seven days, and
-- both are callable straight from the browser. The trial's capabilities are now
-- explicit (trial_sections(), 20261063) and neither is one of them, so both
-- charge the trial exactly what they charge an account with no plan.
--
-- Only the trial waiver is removed; every other line is the function as it was
-- (20260813000000 and 20260809000000). One waiver is deliberately kept, and
-- reported: submit_paid_service_request (20261044000000) still files ONE free
-- request per service in the free week. That is a request to a human desk, not
-- an AI service or a section, and it is an explicit, separately designed
-- capability rather than part of "everything open".

create or replace function public.create_bazaar_shop(
  _name text,
  _tier text,
  _description text default null,
  _theme_color text default '#f59e0b',
  _sign_style text default 'neon',
  _country text default null,
  _email_notifications boolean default true,
  _whatsapp_notifications boolean default false,
  _whatsapp_number text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _user_id uuid := auth.uid();
  _shop_id uuid;
  _setup_cost integer;
begin
  if _user_id is null then
    raise exception 'Not authenticated';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(_user_id::text, 0));

  if exists (select 1 from public.bazaar_shops where owner_id = _user_id) then
    raise exception 'You already have a VXBazaar shop';
  end if;
  if length(trim(coalesce(_name, ''))) not between 2 and 80 then
    raise exception 'Shop name must be between 2 and 80 characters';
  end if;
  if _tier not in ('kiosk', 'boutique', 'store', 'flagship') then
    raise exception 'Invalid shop tier';
  end if;
  if _sign_style not in ('neon', 'royal', 'cyber', 'simple') then
    raise exception 'Invalid sign style';
  end if;
  if _theme_color !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'Invalid theme color';
  end if;

  _setup_cost := case _tier
    when 'kiosk' then 5000
    when 'boutique' then 20000
    when 'store' then 60000
    when 'flagship' then 150000
  end;

  -- The free week no longer waives the setup cost: a shop is not one of the
  -- trial's capabilities (trial_sections()), so an account on the trial pays
  -- exactly what an account with no plan pays.
  perform public.spend_vx(
    _setup_cost,
    'bazaar_shop',
    null,
    initcap(_tier) || ' — ' || trim(_name)
  );

  insert into public.bazaar_shops (
    owner_id, name, tier, description, theme_color, sign_style, country,
    is_active, email_notifications, whatsapp_notifications, whatsapp_number
  ) values (
    _user_id, trim(_name), _tier, nullif(trim(_description), ''),
    _theme_color, _sign_style, nullif(upper(trim(_country)), ''),
    true, coalesce(_email_notifications, true),
    coalesce(_whatsapp_notifications, false),
    nullif(trim(_whatsapp_number), '')
  )
  returning id into _shop_id;

  return _shop_id;
end;
$$;

revoke all on function public.create_bazaar_shop(text, text, text, text, text, text, boolean, boolean, text) from public;
grant execute on function public.create_bazaar_shop(text, text, text, text, text, text, boolean, boolean, text) to authenticated;

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

  -- The free week no longer opens paid courses: the Academy is not one of the
  -- trial's capabilities (trial_sections()), so an account on the trial pays
  -- exactly what an account with no plan pays.
  IF NOT _course.is_free THEN
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
