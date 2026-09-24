-- Mistral (Voxtral) as the voice-cloning provider.
--
-- ELEVENLABS_API_KEY has never been configured, so voice cloning failed for
-- everyone. voice-studio now clones with Mistral when that key is absent, on
-- the MISTRAL_API_KEY the chat fallback already uses, and speech-generate and
-- the WhatsApp voice reply speak those clones through the shared TTS seam.
--
-- These rows exist so the provider registry records what actually runs:
--   * mistral-vc  (voice_cloning) — active; recorded by voice-studio.
--   * mistral-tts (tts)           — active at priority 30, behind OpenAI (10).
--     It only ever speaks a cloned voice by its id: speech-generate's default
--     maps a routed slug through SLUG_TO_TTS_PROVIDER, which does not include
--     it, so even if the router ranked it first the default stays OpenAI.
--
-- Advisory only. Nothing selects a provider from these rows. Re-runnable.

INSERT INTO public.ph_providers
  (name, slug, type, status, priority, api_key_ref, base_url, default_model,
   capabilities, cost_per_request, is_system, config)
VALUES
  ('Mistral Voxtral TTS', 'mistral-tts', 'tts', 'active', 30, 'MISTRAL_API_KEY',
   'https://api.mistral.ai/v1', 'voxtral-mini-tts-2603',
   ARRAY['cloned-voices', 'multilingual'], 0,
   true,
   jsonb_build_object('languages', jsonb_build_array('en','fr','es','pt','it','nl','de','hi','ar'),
                      'notes', 'Speaks cloned voices only; never a default voice.')),
  ('Mistral Voxtral Cloning', 'mistral-vc', 'voice_cloning', 'active', 20, 'MISTRAL_API_KEY',
   'https://api.mistral.ai/v1', 'voxtral-mini-tts-2603',
   ARRAY['zero-shot', 'multilingual'], 0,
   true,
   jsonb_build_object('min_sample_sec', 3,
                      'notes', 'Used by voice-studio when ELEVENLABS_API_KEY is not configured.'))
ON CONFLICT (slug) DO NOTHING;
