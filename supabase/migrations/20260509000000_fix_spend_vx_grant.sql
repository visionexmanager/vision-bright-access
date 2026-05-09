-- Grant execute on spend_vx to authenticated users (was missing)
GRANT EXECUTE ON FUNCTION public.spend_vx(integer, text, text, text) TO authenticated;
