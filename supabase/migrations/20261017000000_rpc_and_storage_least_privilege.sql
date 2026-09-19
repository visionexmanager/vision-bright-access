-- ── Least privilege for privileged functions and user-upload buckets ────────
--
-- Found by executing every migration in PGlite and asking the final schema
-- which SECURITY DEFINER functions anon or authenticated can run without the
-- body checking who is calling, then probing production with arguments that
-- could not write anything (a random, non-existent user id).
--
--   record_device_fingerprint  anyone could attach a device to any user id
--   maybe_revoke_trial         anyone could run the revocation for any user id;
--                              with the above, that ends a stranger's trial
--   cleanup_stale_voice_rooms  anyone could pass a zero interval and empty
--                              every voice room on the site
--   billing_get_status         anyone could read any user's trial, wallet and
--                              usage by id
--   bump_library_daily_stat    anyone could rewrite any book's statistics
--   sweep_whatsapp_*_cache     maintenance anyone could trigger
--
-- plus thirteen SECURITY DEFINER functions with no pinned search_path, and
-- storage read policies that matched on bucket_id alone. A public bucket serves
-- its files by URL with no policy at all; a read policy only adds the ability
-- to LIST the bucket. For buckets that hold what people upload — contact-form
-- attachments, children's group and studio files, image-tool inputs — that
-- listing is what made unguessable names guessable.
--
-- Every change keeps the real callers working. Each is named below with the
-- caller it was checked against.

-- ── Device fingerprint: only for yourself ──────────────────────────────────
-- Caller: src/pages/Signup.tsx, right after sign-in, with the new user's id.
CREATE OR REPLACE FUNCTION public.record_device_fingerprint(
  _device_id  text,
  _user_id    uuid,
  _user_agent text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR _user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'A device can only be recorded for the signed-in account'
      USING ERRCODE = '42501';
  END IF;
  IF _device_id IS NULL OR char_length(_device_id) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'Invalid device id' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.device_fingerprints (device_id, user_id, user_agent)
  VALUES (_device_id, _user_id, left(_user_agent, 500))
  ON CONFLICT (device_id, user_id) DO UPDATE
    SET last_seen_at = now(),
        user_agent   = coalesce(left(_user_agent, 500), public.device_fingerprints.user_agent);
END;
$$;

REVOKE ALL ON FUNCTION public.record_device_fingerprint(text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_device_fingerprint(text, uuid, text) TO authenticated, service_role;

-- ── Trial revocation: server only ──────────────────────────────────────────
-- No client or function calls it today.
REVOKE ALL ON FUNCTION public.maybe_revoke_trial(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.maybe_revoke_trial(uuid, text) TO service_role;

-- ── Voice room cleanup: never faster than the default ──────────────────────
-- Caller: src/pages/community/VoiceRooms.tsx, signed in.
CREATE OR REPLACE FUNCTION public.cleanup_stale_voice_rooms(p_stale_after interval DEFAULT '00:02:00'::interval)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- A caller may ask for a longer grace period, never a shorter one: a zero
  -- interval would remove everybody who is in a room right now.
  _after interval := greatest(coalesce(p_stale_after, interval '2 minutes'), interval '2 minutes');
BEGIN
  DELETE FROM public.voice_room_members
   WHERE last_seen_at < now() - _after;
  DELETE FROM public.voice_rooms r
   WHERE NOT EXISTS (SELECT 1 FROM public.voice_room_members m WHERE m.room_id = r.id);
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_stale_voice_rooms(interval) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_voice_rooms(interval) TO authenticated, service_role;

-- ── Server-only helpers ─────────────────────────────────────────────────────
-- billing_get_status: supabase/functions/billing-engine, service role only.
REVOKE ALL ON FUNCTION public.billing_get_status(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_get_status(uuid) TO service_role;

-- bump_library_daily_stat*: called from other database functions and
-- triggers, which run as their owner. No client or Edge Function calls them.
REVOKE ALL ON FUNCTION public.bump_library_daily_stat(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bump_library_daily_stat_numeric(uuid, text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_library_daily_stat(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.bump_library_daily_stat_numeric(uuid, text, numeric) TO service_role;

-- WhatsApp cache sweeps: pg_cron, which runs as the owner.
REVOKE ALL ON FUNCTION public.sweep_whatsapp_geo_cache() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sweep_whatsapp_speech_cache() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sweep_whatsapp_geo_cache() TO service_role;
GRANT EXECUTE ON FUNCTION public.sweep_whatsapp_speech_cache() TO service_role;

-- Children's progress by user id is nobody's business before sign-in.
-- Other database functions call these as their owner and are unaffected.
REVOKE ALL ON FUNCTION public.kids_coin_balance(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.kids_habit_streak(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.kids_has_achievement(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kids_coin_balance(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kids_habit_streak(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kids_has_achievement(uuid, text) TO authenticated, service_role;

-- ── Voice studio stats: only your own profile ──────────────────────────────
-- Caller: src/services/ai-media-studio/voiceStudioService.ts, signed in.
CREATE OR REPLACE FUNCTION public.vs_sync_profile_stats(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.vs_voice_profiles
  SET
    sample_count       = (SELECT count(*) FROM public.vs_voice_datasets
                           WHERE profile_id = p_profile_id AND status = 'accepted'),
    total_duration_sec = (SELECT coalesce(sum(duration_sec), 0) FROM public.vs_voice_datasets
                           WHERE profile_id = p_profile_id AND status = 'accepted'),
    updated_at         = now()
  WHERE id = p_profile_id
    AND (user_id = auth.uid() OR auth.role() = 'service_role');
END;
$$;

REVOKE ALL ON FUNCTION public.vs_sync_profile_stats(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vs_sync_profile_stats(uuid) TO authenticated, service_role;

-- ── Media studio helpers act for auth.uid(); a guest has none ──────────────
REVOKE ALL ON FUNCTION public.ams_log_activity(uuid, uuid, text, text, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ams_recalculate_storage(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ams_record_voice_usage(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.vx_use_template(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ams_log_activity(uuid, uuid, text, text, uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ams_recalculate_storage(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ams_record_voice_usage(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.vx_use_template(uuid) TO authenticated, service_role;

-- ── A pinned search_path on every SECURITY DEFINER function ────────────────
-- Without it, a function running with its owner's rights resolves unqualified
-- names through whatever search_path the caller set.
ALTER FUNCTION public.ams_log_activity(uuid, uuid, text, text, uuid, jsonb) SET search_path = public;
ALTER FUNCTION public.ams_recalculate_storage(uuid) SET search_path = public;
ALTER FUNCTION public.ams_record_voice_usage(text) SET search_path = public;
ALTER FUNCTION public.billing_consume(uuid, text, text, uuid, text, text, jsonb) SET search_path = public;
ALTER FUNCTION public.billing_get_status(uuid) SET search_path = public;
ALTER FUNCTION public.billing_grant_credits(uuid, integer, text, text) SET search_path = public;
ALTER FUNCTION public.billing_initialize_user(uuid, text) SET search_path = public;
ALTER FUNCTION public.billing_refund(uuid, text, text) SET search_path = public;
ALTER FUNCTION public.ph_get_provider_stats(uuid, integer) SET search_path = public;
ALTER FUNCTION public.ph_record_metric(uuid, boolean, integer, numeric) SET search_path = public;
ALTER FUNCTION public.vs_log_training(uuid, text, text, jsonb) SET search_path = public;
ALTER FUNCTION public.vx_use_template(uuid) SET search_path = public;

-- ── Buckets of uploads: files by URL, no listing by strangers ─────────────
-- Every uploader names the file by URL (getPublicUrl) and nothing lists these
-- buckets except health-check, which uses the service role. Upload policies
-- are untouched; none of the uploads uses upsert, which would need SELECT.

-- Contact-form attachments: staff open them from the request. Nobody lists.
DROP POLICY IF EXISTS "contact_attachments_read" ON storage.objects;

-- Voice room uploads are named rooms/<room>/…; shared by URL in the room.
DROP POLICY IF EXISTS "voice_room_uploads_select" ON storage.objects;

-- These are named <user id>/…: an uploader may still list their own folder.
DROP POLICY IF EXISTS "kids-social-media: public read" ON storage.objects;
DROP POLICY IF EXISTS "kids_studio_media_read" ON storage.objects;
DROP POLICY IF EXISTS "image_tool_inputs_public_read" ON storage.objects;
DROP POLICY IF EXISTS "library_group_submissions_read" ON storage.objects;

DROP POLICY IF EXISTS "user uploads: owner lists own folder" ON storage.objects;
CREATE POLICY "user uploads: owner lists own folder"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id IN ('kids-social-media', 'kids-studio-media', 'image-tool-inputs', 'library-group-submissions')
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
