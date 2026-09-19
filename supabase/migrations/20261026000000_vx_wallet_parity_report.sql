-- Read-only. Nothing in this file writes, updates or deletes anything.
--
-- Before a single balance moves, the question has to be answered: are
-- `credit_wallets.balance_vx` and `SUM(user_points.points)` the same unit of
-- the same currency, and can the number in the wallet be *explained*?
--
-- `vx_wallet_migration_report()` (20261024) answers "how much would move".
-- This answers "should it", and it is the stricter question. It classifies
-- every account into the seven buckets a migration can go wrong in, and it
-- tests one accounting identity that decides whether 1:1 is defensible:
--
--     credit_wallets.balance_vx  =  SUM(credit_transactions.amount_vx)
--
-- That holds only if every movement of that wallet went through
-- `billing_grant_credits`, `billing_consume` or `billing_refund` — each of
-- which writes a transaction row and updates the wallet in the same call. A
-- wallet that disagrees with its own transaction history has been written by
-- something else, and its balance is a number of unknown provenance. Migrating
-- one of those 1:1 would be inventing VX.
--
-- The second identity is the wallet's own bookkeeping:
--
--     balance_vx  =  lifetime_earned_vx - lifetime_spent_vx
--
-- which `billing_refund` deliberately bends — it does
-- `lifetime_spent_vx = GREATEST(0, lifetime_spent_vx - refund)` — so a wallet
-- that was refunded past zero will fail this one for a reason that is not a
-- data fault. It is reported separately for exactly that reason.

CREATE OR REPLACE FUNCTION public.vx_wallet_parity_report(_sample integer DEFAULT 25)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _limit  integer := LEAST(GREATEST(COALESCE(_sample, 25), 1), 200);
  _has_vx_col boolean;
  _out    jsonb;
BEGIN
  -- Admin-only, but readable by the service role for a scripted check. A
  -- signed-out caller (auth.uid() IS NULL) is the service role here.
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admins_only');
  END IF;

  -- `admin_give_vx` writes `profiles.vx_balance`. Whether that column exists
  -- at all is part of the report, because if it does not, every grant made
  -- through that function raised an error rather than landing anywhere.
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'vx_balance'
  ) INTO _has_vx_col;

  WITH points AS (
    SELECT user_id,
           SUM(points)::bigint            AS points_total,
           count(*)::bigint               AS points_rows,
           SUM(points) FILTER (WHERE points > 0)::bigint AS points_earned,
           SUM(-points) FILTER (WHERE points < 0)::bigint AS points_spent
      FROM public.user_points
     GROUP BY user_id
  ),
  txns AS (
    SELECT user_id,
           SUM(amount_vx)::bigint AS txn_sum,
           count(*)::bigint       AS txn_rows,
           count(*) FILTER (WHERE type = 'spend')::bigint  AS spends,
           count(*) FILTER (WHERE type = 'refund')::bigint AS refunds
      FROM public.credit_transactions
     GROUP BY user_id
  ),
  -- Every account known to either system, so C and D are symmetrical.
  accounts AS (
    SELECT COALESCE(w.user_id, p.user_id)                AS user_id,
           w.user_id IS NOT NULL                         AS has_wallet,
           COALESCE(w.balance_vx, 0)::bigint             AS wallet,
           COALESCE(w.lifetime_earned_vx, 0)::bigint     AS wallet_earned,
           COALESCE(w.lifetime_spent_vx, 0)::bigint      AS wallet_spent,
           p.user_id IS NOT NULL                         AS has_points,
           COALESCE(p.points_total, 0)                   AS points,
           COALESCE(p.points_rows, 0)                    AS points_rows,
           COALESCE(t.txn_sum, 0)                        AS txn_sum,
           COALESCE(t.txn_rows, 0)                       AS txn_rows,
           COALESCE(t.spends, 0)                         AS spends,
           COALESCE(t.refunds, 0)                        AS refunds,
           (SELECT s.plan_id FROM public.user_subscriptions s
             WHERE s.user_id = COALESCE(w.user_id, p.user_id)
               AND s.status = 'active'
               AND (s.ends_at IS NULL OR s.ends_at > now())
             ORDER BY s.started_at DESC LIMIT 1)         AS plan_id,
           EXISTS (SELECT 1 FROM public.vx_wallet_migrations m
                    WHERE m.user_id = COALESCE(w.user_id, p.user_id)) AS already_migrated
      FROM public.credit_wallets w
      FULL OUTER JOIN points p ON p.user_id = w.user_id
      LEFT JOIN txns t ON t.user_id = COALESCE(w.user_id, p.user_id)
  ),
  classified AS (
    SELECT a.*,
           -- The provenance test. A wallet whose balance its own transaction
           -- history cannot explain is a number of unknown origin.
           (a.has_wallet AND a.wallet <> a.txn_sum)                     AS ledger_disagrees,
           (a.has_wallet AND a.wallet > 0 AND a.txn_rows = 0)           AS no_provenance,
           -- The wallet's own counters. billing_refund clamps lifetime_spent
           -- at zero, so this can differ for a benign reason.
           (a.has_wallet AND a.wallet <> a.wallet_earned - a.wallet_spent) AS counters_disagree,
           (a.has_wallet AND a.has_points AND a.wallet = a.points)      AS exact_match,
           (a.has_wallet AND a.has_points AND a.wallet <> a.points)     AS mismatch,
           (a.has_wallet AND NOT a.has_points)                          AS wallet_only,
           (a.has_points AND NOT a.has_wallet)                          AS points_only,
           (a.points < 0 OR a.wallet < 0)                               AS negative,
           (a.spends > 0)                                               AS has_consumed
      FROM accounts a
  ),
  -- F. The same grant, to the same account, for the same amount, on the same
  --    day, more than once. A retry that was not idempotent looks exactly like
  --    this — `billing_grant_credits` takes no idempotency key at all.
  dupes AS (
    SELECT user_id, description, amount_vx, created_at::date AS day, count(*)::bigint AS times
      FROM public.credit_transactions
     WHERE type IN ('subscription_grant', 'admin_grant', 'purchase')
     GROUP BY 1, 2, 3, 4
    HAVING count(*) > 1
  )
  SELECT jsonb_build_object(
    'ok', true,
    'generated_at', now(),
    'read_only', true,
    'profiles_vx_balance_column', CASE WHEN _has_vx_col THEN 'present' ELSE 'absent' END,

    'totals', jsonb_build_object(
      'accounts_seen',        (SELECT count(*) FROM classified),
      'wallets',              (SELECT count(*) FILTER (WHERE has_wallet) FROM classified),
      'wallets_with_balance', (SELECT count(*) FILTER (WHERE has_wallet AND wallet > 0) FROM classified),
      'points_accounts',      (SELECT count(*) FILTER (WHERE has_points) FROM classified),
      'vx_in_wallets',        (SELECT COALESCE(SUM(wallet), 0) FROM classified),
      'vx_in_points',         (SELECT COALESCE(SUM(points), 0) FROM classified),
      'already_migrated',     (SELECT count(*) FILTER (WHERE already_migrated) FROM classified)
    ),

    'categories', jsonb_build_object(
      'a_exact_match',            (SELECT count(*) FROM classified WHERE exact_match),
      'b_mismatch',               (SELECT count(*) FROM classified WHERE mismatch),
      'c_wallet_without_points',  (SELECT count(*) FROM classified WHERE wallet_only),
      'd_points_without_wallet',  (SELECT count(*) FROM classified WHERE points_only),
      'e_negative_balance',       (SELECT count(*) FROM classified WHERE negative),
      'f_duplicate_grants',       (SELECT COALESCE(count(*), 0) FROM dupes),
      'g_ambiguous', jsonb_build_object(
        'ledger_disagrees',   (SELECT count(*) FROM classified WHERE ledger_disagrees),
        'no_provenance',      (SELECT count(*) FROM classified WHERE no_provenance),
        'counters_disagree',  (SELECT count(*) FROM classified WHERE counters_disagree)
      )
    ),

    -- The verdict the migration decision turns on. `safe_1to1` is true only
    -- when every wallet carrying a balance can be explained by its own
    -- transaction history and nothing is negative or duplicated.
    'accounting', jsonb_build_object(
      'identity', 'credit_wallets.balance_vx = SUM(credit_transactions.amount_vx)',
      'wallets_explained',   (SELECT count(*) FROM classified WHERE has_wallet AND wallet > 0 AND NOT ledger_disagrees),
      'wallets_unexplained', (SELECT count(*) FROM classified WHERE has_wallet AND wallet > 0 AND ledger_disagrees),
      'accounts_that_have_consumed', (SELECT count(*) FROM classified WHERE has_consumed),
      'safe_1to1', (
        (SELECT count(*) FROM classified WHERE has_wallet AND wallet > 0 AND ledger_disagrees) = 0
        AND (SELECT count(*) FROM classified WHERE negative) = 0
        AND (SELECT COALESCE(count(*), 0) FROM dupes) = 0
      )
    ),

    -- Bounded samples, so this stays a report rather than a data export. User
    -- ids only: no email, no name — the same decision whatsapp_entitlements
    -- took about what a billing answer is allowed to carry.
    'samples', jsonb_build_object(
      'b_mismatch', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'user_id', user_id, 'wallet', wallet, 'points', points, 'difference', wallet - points,
          'txn_sum', txn_sum, 'plan_id', plan_id, 'has_consumed', has_consumed)), '[]')
        FROM (SELECT * FROM classified WHERE mismatch ORDER BY abs(wallet - points) DESC LIMIT _limit) x),
      'c_wallet_without_points', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'user_id', user_id, 'wallet', wallet, 'txn_rows', txn_rows)), '[]')
        FROM (SELECT * FROM classified WHERE wallet_only ORDER BY wallet DESC LIMIT _limit) x),
      'e_negative_balance', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'user_id', user_id, 'wallet', wallet, 'points', points)), '[]')
        FROM (SELECT * FROM classified WHERE negative ORDER BY points LIMIT _limit) x),
      'f_duplicate_grants', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'user_id', user_id, 'amount_vx', amount_vx, 'day', day, 'times', times)), '[]')
        FROM (SELECT * FROM dupes ORDER BY times DESC, amount_vx DESC LIMIT _limit) x),
      'g_unexplained', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'user_id', user_id, 'wallet', wallet, 'txn_sum', txn_sum, 'txn_rows', txn_rows,
          'earned', wallet_earned, 'spent', wallet_spent)), '[]')
        FROM (SELECT * FROM classified WHERE has_wallet AND wallet > 0 AND (ledger_disagrees OR no_provenance)
               ORDER BY wallet DESC LIMIT _limit) x)
    )
  ) INTO _out;

  RETURN _out;
END;
$$;

COMMENT ON FUNCTION public.vx_wallet_parity_report(integer) IS
  'Read-only. Classifies every account across credit_wallets and user_points into the seven ways a 1:1 migration can go wrong, and tests whether each wallet balance is explained by its own credit_transactions history. accounting.safe_1to1 is the verdict.';

REVOKE ALL ON FUNCTION public.vx_wallet_parity_report(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vx_wallet_parity_report(integer) TO authenticated, service_role;

-- ── One account, in full ────────────────────────────────────────────────────
--
-- The report above is counts and samples. This is what an admin opens when a
-- sample row needs explaining: every movement on both sides, in order.

CREATE OR REPLACE FUNCTION public.vx_account_parity_detail(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _out jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admins_only');
  END IF;

  SELECT jsonb_build_object(
    'ok', true,
    'user_id', _user_id,
    'wallet', (SELECT jsonb_build_object(
                 'balance_vx', w.balance_vx,
                 'lifetime_earned_vx', w.lifetime_earned_vx,
                 'lifetime_spent_vx', w.lifetime_spent_vx)
                 FROM public.credit_wallets w WHERE w.user_id = _user_id),
    'points_total', (SELECT COALESCE(SUM(points), 0) FROM public.user_points WHERE user_id = _user_id),
    'plan_id', (SELECT s.plan_id FROM public.user_subscriptions s
                 WHERE s.user_id = _user_id AND s.status = 'active'
                   AND (s.ends_at IS NULL OR s.ends_at > now())
                 ORDER BY s.started_at DESC LIMIT 1),
    'already_migrated', EXISTS (SELECT 1 FROM public.vx_wallet_migrations m WHERE m.user_id = _user_id),
    -- Both histories, newest first, bounded. `description` is the operator's
    -- own words and carries no third-party detail.
    'credit_transactions', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'type', type, 'amount_vx', amount_vx, 'balance_after', balance_after,
        'operation_type', operation_type, 'created_at', created_at) ORDER BY created_at DESC), '[]')
      FROM (SELECT * FROM public.credit_transactions WHERE user_id = _user_id
             ORDER BY created_at DESC LIMIT 100) t),
    'user_points', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'points', points, 'reason', reason, 'created_at', created_at) ORDER BY created_at DESC), '[]')
      FROM (SELECT * FROM public.user_points WHERE user_id = _user_id
             ORDER BY created_at DESC LIMIT 100) p)
  ) INTO _out;

  RETURN _out;
END;
$$;

COMMENT ON FUNCTION public.vx_account_parity_detail(uuid) IS
  'Read-only. Both VX histories for one account, for explaining a row the parity report flagged.';

REVOKE ALL ON FUNCTION public.vx_account_parity_detail(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vx_account_parity_detail(uuid) TO authenticated, service_role;
