-- Register Google Cloud Text-to-Speech for metering and provider health.
-- The adapter only calls Google when GOOGLE_CLOUD_TTS_API_KEY is configured.
-- Standard voices have a monthly free quota; usage beyond quota can be billed.
INSERT INTO ph_providers
  (name, slug, type, status, priority, api_key_ref, default_model, capabilities, cost_per_request, is_system, config)
VALUES
  ('Google Cloud Text-to-Speech', 'google-cloud-tts', 'tts', 'active', 30,
   'GOOGLE_CLOUD_TTS_API_KEY', 'standard-voices',
   ARRAY['multilingual', 'speed', 'format'], 0.016, true,
   '{"max_chars": 4000, "formats": ["mp3", "wav", "ogg"], "pricing_basis": "per_character", "free_quota_applies": true}')
ON CONFLICT (slug) DO NOTHING;
