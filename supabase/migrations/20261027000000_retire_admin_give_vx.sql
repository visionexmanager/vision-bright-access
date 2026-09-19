-- `admin_give_vx` never worked, and it is the only VX function that could not.
--
-- It does:
--
--     UPDATE public.profiles SET vx_balance = COALESCE(vx_balance, 0) + _amount
--
-- and `profiles` has no `vx_balance` column. Confirmed twice against
-- production on 2026-09-19: absent from the generated types, and
-- `information_schema.columns` returns zero rows for it. So the function did
-- not write into a column nobody reads — it raised
-- `column "vx_balance" ... does not exist` on every call, after passing its
-- admin check. Nothing in the repository calls it, no trigger depends on it,
-- and `admin_adjust_vx` (20261016) has been the working path all along: it
-- writes `user_points`, supports revocation as well as grants, and records
-- `admin_logs`.
--
-- Dropped rather than repaired. Repairing it would mean recreating
-- `profiles.vx_balance`, which is a second VX balance — the exact thing this
-- phase exists to remove. There is one balance, and it is `SUM(user_points)`.
--
-- No balance changes. The function has never successfully altered one.

DROP FUNCTION IF EXISTS public.admin_give_vx(uuid, integer, text);

-- A note where the next person will look for it.
COMMENT ON FUNCTION public.admin_adjust_vx(text, integer, text) IS
  'The one admin path for granting or revoking VX. Writes a signed row into user_points — the balance is SUM(points), there is no balance column — and records admin_logs. Replaced admin_give_vx, which wrote a profiles.vx_balance column that does not exist and therefore always raised.';
