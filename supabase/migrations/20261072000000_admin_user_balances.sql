-- admin_user_balances: every user's VX balance, for the admin user list.
--
-- Why this exists. src/pages/admin/AdminUsers.tsx showed each user's balance by
-- summing `select user_id, points from user_points` in the browser. user_points has
-- one SELECT policy, "Users can view their own points" (auth.uid() = user_id), and
-- no admin policy, so an admin session reads only its own rows: the column showed 0
-- for everyone else. (Verified by executing the migrations in PGlite; production was
-- not read.) Widening the table's policy to admins would expose every user's ledger
-- rows (reasons included) to anything that can use an admin session; this returns
-- only the totals.
--
-- Shape. The balance is SUM(points) per user, the same definition vx_balance() uses
-- ("there is one balance, and it is SUM(user_points)"). One jsonb object
-- {"<user_id>": <balance>, ...} rather than a set of rows, because the REST layer cuts
-- a result set off at its row cap without an error. Users with no rows are absent
-- (their balance is 0).
--
-- Access. SECURITY DEFINER, so it reads the table without the caller's RLS, which is
-- why it refuses everyone who is not an admin inside the function and why anon has
-- no EXECUTE at all. Read-only: it writes nothing and changes no balance.
CREATE OR REPLACE FUNCTION public.admin_user_balances()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN COALESCE(
    (SELECT jsonb_object_agg(t.user_id::text, t.balance)
       FROM (SELECT up.user_id, SUM(up.points)::bigint AS balance
               FROM public.user_points up
              GROUP BY up.user_id) t),
    '{}'::jsonb
  );
END;
$$;

COMMENT ON FUNCTION public.admin_user_balances() IS
  'Admin only. {user_id: SUM(user_points.points)} for every user with at least one row. Read-only; the totals the admin user list shows.';

REVOKE ALL ON FUNCTION public.admin_user_balances() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_user_balances() TO authenticated, service_role;
