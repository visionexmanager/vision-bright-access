-- Phase 1, the careful part: moving `credit_wallets` onto `user_points`.
--
-- Two functions, and only one of them changes anything.
--
-- `vx_wallet_migration_report()` is read-only and answers the question nobody
-- can answer from outside the database: how much VX is sitting in
-- `credit_wallets` that its owners cannot see, and what would each person's
-- balance become. Run it, read it, and only then decide.
--
-- `vx_migrate_wallet_balances()` performs the move. It defaults to a dry run,
-- refuses to run twice for the same wallet, and writes an audit row per user.
-- **It is not called by this migration, by any Edge Function, or by any
-- schedule.** Applying this file changes no balance.
--
-- ── Why a migration is needed at all ────────────────────────────────────────
--
-- `credit_wallets.balance_vx` is the balance a complete billing authority was
-- built around, and `billing_consume()` is called by nothing — so whatever is
-- in those rows was granted and then stranded. `user_points` is what
-- `usePoints`, `spend_vx`, the Arcade and now `vx_reserve` all read. One of
-- them has to become the other, and it has to be the one people can spend.
--
-- ── Why it is additive ──────────────────────────────────────────────────────
--
-- The move is an INSERT of a positive row into `user_points`, which is an
-- append-only ledger. `credit_wallets` is left standing with its balance
-- intact and a marker row in `vx_wallet_migrations` recording what was
-- credited. Nothing is dropped, so the rollback is an INSERT of the negation —
-- see the rollback function at the bottom, which exists for the same reason.

-- ── What was moved, and when ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.vx_wallet_migrations (
  user_id       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_balance_before integer NOT NULL,
  points_balance_before integer NOT NULL,
  credited_vx   integer NOT NULL,
  points_balance_after  integer NOT NULL,
  migrated_at   timestamptz NOT NULL DEFAULT now(),
  reverted_at   timestamptz,
  actor_id      uuid
);

COMMENT ON TABLE public.vx_wallet_migrations IS
  'One row per account whose credit_wallets balance was credited into user_points. The PRIMARY KEY is what makes the migration safe to re-run: a second pass finds the row and skips.';

ALTER TABLE public.vx_wallet_migrations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                   AND tablename = 'vx_wallet_migrations' AND policyname = 'vx_wallet_migrations_read_admin') THEN
    CREATE POLICY "vx_wallet_migrations_read_admin"
      ON public.vx_wallet_migrations FOR SELECT TO authenticated
      USING ((select public.has_role(auth.uid(), 'admin')));
  END IF;
END $$;

REVOKE ALL ON TABLE public.vx_wallet_migrations FROM anon;
GRANT SELECT ON TABLE public.vx_wallet_migrations TO authenticated;
GRANT ALL ON TABLE public.vx_wallet_migrations TO service_role;

-- ── The report: read-only, and the thing to run first ───────────────────────

CREATE OR REPLACE FUNCTION public.vx_wallet_migration_report()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _report jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') AND auth.uid() IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admins_only');
  END IF;

  WITH wallets AS (
    SELECT w.user_id,
           w.balance_vx,
           COALESCE((SELECT SUM(p.points) FROM public.user_points p WHERE p.user_id = w.user_id), 0)::integer AS points_now,
           EXISTS (SELECT 1 FROM public.vx_wallet_migrations m WHERE m.user_id = w.user_id) AS already
      FROM public.credit_wallets w
  )
  SELECT jsonb_build_object(
    'ok', true,
    'generated_at', now(),
    'wallets_total', (SELECT count(*) FROM wallets),
    'wallets_with_balance', (SELECT count(*) FROM wallets WHERE balance_vx > 0),
    'wallets_already_migrated', (SELECT count(*) FROM wallets WHERE already),
    'wallets_pending', (SELECT count(*) FROM wallets WHERE balance_vx > 0 AND NOT already),
    'vx_to_credit', (SELECT COALESCE(SUM(balance_vx), 0) FROM wallets WHERE balance_vx > 0 AND NOT already),
    'vx_already_in_points', (SELECT COALESCE(SUM(points_now), 0) FROM wallets),
    -- The two that would surprise somebody reading a spreadsheet.
    'largest_single_credit', (SELECT COALESCE(MAX(balance_vx), 0) FROM wallets WHERE NOT already),
    'wallets_with_negative_points', (SELECT count(*) FROM wallets WHERE points_now < 0),
    -- A sample, not the list: this returns to an admin screen and a thousand
    -- user ids on a screen is not a report, it is a data export.
    'sample', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'user_id', user_id, 'wallet', balance_vx,
               'points_now', points_now, 'points_after', points_now + balance_vx)), '[]')
        FROM (SELECT * FROM wallets WHERE balance_vx > 0 AND NOT already
               ORDER BY balance_vx DESC LIMIT 20) top
    )
  ) INTO _report;

  RETURN _report;
END;
$$;

COMMENT ON FUNCTION public.vx_wallet_migration_report() IS
  'Read-only. What the wallet migration would do, before anybody does it. Run this, read it, then decide.';

REVOKE ALL ON FUNCTION public.vx_wallet_migration_report() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vx_wallet_migration_report() TO authenticated, service_role;

-- ── The move itself ─────────────────────────────────────────────────────────
--
-- Dry by default. `_dry_run => false` is the only way to change a balance, and
-- it is deliberately ugly to type.

CREATE OR REPLACE FUNCTION public.vx_migrate_wallet_balances(
  _dry_run   boolean DEFAULT true,
  _batch_size integer DEFAULT 500
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row     record;
  _points  integer;
  _moved   integer := 0;
  _vx      bigint  := 0;
  _actor   uuid := auth.uid();
BEGIN
  IF _actor IS NOT NULL AND NOT public.has_role(_actor, 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admins_only');
  END IF;

  FOR _row IN
    SELECT w.user_id, w.balance_vx
      FROM public.credit_wallets w
     WHERE w.balance_vx > 0
       AND NOT EXISTS (SELECT 1 FROM public.vx_wallet_migrations m WHERE m.user_id = w.user_id)
     ORDER BY w.user_id
     LIMIT GREATEST(COALESCE(_batch_size, 500), 1)
     FOR UPDATE OF w SKIP LOCKED
  LOOP
    _moved := _moved + 1;
    _vx := _vx + _row.balance_vx;

    CONTINUE WHEN _dry_run;

    PERFORM pg_advisory_xact_lock(hashtextextended(_row.user_id::text, 0));

    SELECT COALESCE(SUM(points), 0)::integer INTO _points
      FROM public.user_points WHERE user_id = _row.user_id;

    INSERT INTO public.user_points (user_id, points, reason)
    VALUES (_row.user_id, _row.balance_vx, 'VX Purchase: wallet migration');

    -- The marker is what makes a second pass a no-op. Written in the same
    -- transaction as the credit, so a crash between them is impossible.
    INSERT INTO public.vx_wallet_migrations
      (user_id, wallet_balance_before, points_balance_before, credited_vx, points_balance_after, actor_id)
    VALUES
      (_row.user_id, _row.balance_vx, _points, _row.balance_vx, _points + _row.balance_vx, _actor);
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'dry_run', _dry_run,
    'wallets_in_batch', _moved,
    'vx_in_batch', _vx,
    'remaining', (SELECT count(*) FROM public.credit_wallets w
                   WHERE w.balance_vx > 0
                     AND NOT EXISTS (SELECT 1 FROM public.vx_wallet_migrations m WHERE m.user_id = w.user_id))
                 - CASE WHEN _dry_run THEN 0 ELSE 0 END);
END;
$$;

COMMENT ON FUNCTION public.vx_migrate_wallet_balances(boolean, integer) IS
  'Credits credit_wallets balances into user_points, in batches, once per account. Dry by default; _dry_run => false is the only way to move a balance. credit_wallets is left intact — this is additive, and vx_revert_wallet_migration() undoes it.';

REVOKE ALL ON FUNCTION public.vx_migrate_wallet_balances(boolean, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vx_migrate_wallet_balances(boolean, integer) TO service_role;

-- ── Undo ────────────────────────────────────────────────────────────────────
--
-- Written now rather than when it is needed. A rollback plan that exists only
-- in a document is a rollback plan nobody has run.
--
-- It refuses an account that has spent since the migration, because taking the
-- credit back out would push that balance below what the person has already
-- used — and `user_points` has no constraint to stop it. Those are reported
-- for a human rather than handled automatically.

CREATE OR REPLACE FUNCTION public.vx_revert_wallet_migration(_dry_run boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row     record;
  _balance integer;
  _undone  integer := 0;
  _skipped integer := 0;
  _actor   uuid := auth.uid();
BEGIN
  IF _actor IS NOT NULL AND NOT public.has_role(_actor, 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admins_only');
  END IF;

  FOR _row IN
    SELECT * FROM public.vx_wallet_migrations
     WHERE reverted_at IS NULL
     ORDER BY migrated_at
     FOR UPDATE SKIP LOCKED
  LOOP
    SELECT COALESCE(SUM(points), 0)::integer INTO _balance
      FROM public.user_points WHERE user_id = _row.user_id;

    -- Would the reversal leave them short? Then it is not a reversal, it is a
    -- debt, and a person has to look at it.
    IF _balance - _row.credited_vx < 0 THEN
      _skipped := _skipped + 1;
      CONTINUE;
    END IF;

    _undone := _undone + 1;
    CONTINUE WHEN _dry_run;

    PERFORM pg_advisory_xact_lock(hashtextextended(_row.user_id::text, 0));

    INSERT INTO public.user_points (user_id, points, reason)
    VALUES (_row.user_id, -_row.credited_vx, 'Redeemed: wallet migration reverted');

    UPDATE public.vx_wallet_migrations SET reverted_at = now() WHERE user_id = _row.user_id;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true, 'dry_run', _dry_run,
    'reverted', _undone,
    'skipped_would_go_negative', _skipped);
END;
$$;

REVOKE ALL ON FUNCTION public.vx_revert_wallet_migration(boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vx_revert_wallet_migration(boolean) TO service_role;
