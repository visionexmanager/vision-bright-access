-- The public leaderboard printed people's email addresses.
--
-- A profile whose display name was never changed holds the address it signed up
-- with, and get_leaderboard returned that string to anyone, signed in or not. A
-- production check found 7 of the top 10 rows were addresses. The website page
-- shows them, and so would any other surface that reads this function.
--
-- A name that contains "@" is now cut to its first character and three stars.
-- Anything else is returned exactly as before, and the signature, the columns,
-- the ordering and the grants are unchanged (CREATE OR REPLACE keeps them).

CREATE OR REPLACE FUNCTION public.get_leaderboard(result_limit integer DEFAULT 20)
RETURNS TABLE(user_id uuid, display_name text, avatar_url text, total_points bigint, rank bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    up.user_id,
    CASE
      WHEN p.display_name IS NULL THEN 'Anonymous'
      WHEN position('@' IN p.display_name) > 0 THEN left(p.display_name, 1) || '***'
      ELSE p.display_name
    END AS display_name,
    p.avatar_url,
    SUM(up.points)::bigint AS total_points,
    ROW_NUMBER() OVER (ORDER BY SUM(up.points) DESC)::bigint AS rank
  FROM public.user_points up
  LEFT JOIN public.profiles p ON p.user_id = up.user_id
  GROUP BY up.user_id, p.display_name, p.avatar_url
  ORDER BY total_points DESC
  LIMIT result_limit;
$$;
