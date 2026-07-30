-- ============================================================
-- Migration: VisionKids Social & Parents Hub (Phase 7) — extends RLS on
-- tables the Parents Dashboard needs to read (stories read, games played,
-- daily/weekly mission progress) with a "linked parent can also SELECT"
-- policy, same pattern already used for kids_xp_events in
-- 20260813000000 and kids_lesson_progress back in the Academy phase.
-- These tables keep their existing owner-manages-own ALL policy — this
-- only ADDS read access for a linked parent, it doesn't change what a
-- child can do with their own rows.
-- ============================================================

CREATE POLICY "kids_reading_progress: linked parent reads"
  ON public.kids_reading_progress FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.kids_parent_child_links pcl WHERE pcl.child_user_id = kids_reading_progress.user_id AND pcl.parent_user_id = auth.uid()
  ));

CREATE POLICY "kids_game_sessions: linked parent reads"
  ON public.kids_game_sessions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.kids_parent_child_links pcl WHERE pcl.child_user_id = kids_game_sessions.user_id AND pcl.parent_user_id = auth.uid()
  ));

CREATE POLICY "kids_user_daily_challenge_progress: linked parent reads"
  ON public.kids_user_daily_challenge_progress FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.kids_parent_child_links pcl WHERE pcl.child_user_id = kids_user_daily_challenge_progress.user_id AND pcl.parent_user_id = auth.uid()
  ));

CREATE POLICY "kids_user_weekly_challenge_progress: linked parent reads"
  ON public.kids_user_weekly_challenge_progress FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.kids_parent_child_links pcl WHERE pcl.child_user_id = kids_user_weekly_challenge_progress.user_id AND pcl.parent_user_id = auth.uid()
  ));

CREATE POLICY "kids_quiz_attempts: linked parent reads"
  ON public.kids_quiz_attempts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.kids_parent_child_links pcl WHERE pcl.child_user_id = kids_quiz_attempts.user_id AND pcl.parent_user_id = auth.uid()
  ));

-- ============================================================
-- Storage: kids-social-media — study/reading/creative club materials.
-- Same public-read / owner-path-prefix-write shape as kids-studio-media
-- (20260811000000).
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kids-social-media', 'kids-social-media', true,
  20971520, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf', 'text/plain']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "kids-social-media: public read"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'kids-social-media');

CREATE POLICY "kids-social-media: owner uploads"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kids-social-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "kids-social-media: owner deletes"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'kids-social-media' AND (storage.foldername(name))[1] = auth.uid()::text);
