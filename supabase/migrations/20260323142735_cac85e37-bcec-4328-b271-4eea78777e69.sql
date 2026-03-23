
CREATE OR REPLACE FUNCTION public.get_leaderboard(result_limit integer DEFAULT 20)
RETURNS TABLE(user_id uuid, display_name text, avatar_url text, total_points bigint, rank bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    up.user_id,
    COALESCE(p.display_name, 'Anonymous') as display_name,
    p.avatar_url,
    SUM(up.points)::bigint as total_points,
    ROW_NUMBER() OVER (ORDER BY SUM(up.points) DESC)::bigint as rank
  FROM public.user_points up
  LEFT JOIN public.profiles p ON p.user_id = up.user_id
  GROUP BY up.user_id, p.display_name, p.avatar_url
  ORDER BY total_points DESC
  LIMIT result_limit;
$$;
