// The tables and helpers the subscription-gate and trial-entitlement migrations
// read, as minimal stubs. Shared so the PGlite scenarios, the trial scenarios and
// the real-PostgreSQL concurrency test cannot drift apart.
export const STUBS = `
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
  CREATE TABLE public.user_roles (user_id uuid, role public.app_role);
  CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
    AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
  CREATE TABLE public.billing_plans (id text PRIMARY KEY, is_active boolean NOT NULL DEFAULT true,
    name text NOT NULL DEFAULT '', price_monthly_usd numeric NOT NULL DEFAULT 0, description text,
    features jsonb NOT NULL DEFAULT '[]', limits jsonb NOT NULL DEFAULT '{}');
  -- free_trial starts as the OLD row: every section open, a 200-a-day WhatsApp allowance.
  INSERT INTO public.billing_plans (id, is_active, name, price_monthly_usd, limits) VALUES
    ('free_trial', true, 'Free week', 0,
     '{"whatsapp_daily_messages":200,"sections":["news","community","assistive","assistant","academy","library","arcade","marketplace","kids","career","tv","radio","messages","simulations","mediaStudio","studio","professional","finance"]}'),
    ('kids', true, 'Kids', 3, '{"whatsapp_daily_messages":50,"sections":["news","community","assistive","kids"]}'),
    ('basic', true, 'Basic', 5, '{"whatsapp_daily_messages":150,"sections":["news","community","assistive","assistant","academy","library","arcade","marketplace"]}'),
    ('pro', true, 'Pro', 10, '{"whatsapp_daily_messages":400,"sections":["news","community","assistive","assistant","academy","library","arcade","marketplace","kids","career","tv","radio","messages","simulations"]}'),
    ('business', true, 'Business', 20, '{"whatsapp_daily_messages":0,"sections":["news","community","assistive","assistant","academy","library","arcade","marketplace","kids","career","tv","radio","messages","simulations","mediaStudio","studio","professional","finance"]}'),
    ('legacy_basic', false, 'Legacy', 1, '{}'),
    ('free', true, 'Free', 0, '{}');
  CREATE FUNCTION public.free_sections() RETURNS text[] LANGUAGE sql IMMUTABLE
    AS $$ SELECT ARRAY['news','community','assistive']::text[] $$;
  CREATE FUNCTION public.whatsapp_free_daily_allowance() RETURNS integer LANGUAGE sql IMMUTABLE AS $$ SELECT 20 $$;
  CREATE TABLE public.whatsapp_usage (wa_phone text, usage_date date, metered_count integer);
  CREATE TABLE public.user_subscriptions (id serial PRIMARY KEY, user_id uuid, plan_id text, status text,
    started_at timestamptz DEFAULT now(), ends_at timestamptz);
  CREATE TABLE public.profiles (user_id uuid PRIMARY KEY, trial_expires_at timestamptz);
  CREATE TABLE public.user_points (user_id uuid PRIMARY KEY, balance integer);
  CREATE TABLE public.subscription_orders (user_id uuid, plan_id text, status text);
  CREATE TABLE public.site_settings (key text PRIMARY KEY, value jsonb);
  INSERT INTO public.site_settings VALUES ('owner_contact', '{"whatsapp_number":"+961 70 000 001"}');
  CREATE FUNCTION public.whatsapp_is_owner_number(_wa_phone text) RETURNS boolean LANGUAGE sql STABLE
    AS $$ SELECT right(regexp_replace(_wa_phone,'\\D','','g'),8) = '70000001' $$;
  CREATE TABLE public.whatsapp_identities (wa_phone text PRIMARY KEY, user_id uuid);
`;

/** Every migration the entitlement scenarios execute, in order. */
export const MIGRATIONS = [
  "supabase/migrations/20261062000000_ai_subscription_gate.sql",
  "supabase/migrations/20261063000000_trial_is_not_full_access.sql",
];
