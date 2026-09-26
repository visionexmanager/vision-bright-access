-- OpenRouter, NVIDIA NIM, Bytez and FAL join the provider registry — inactive.
--
-- Each holds a key in GitHub secrets, and none had a registry row, an adapter
-- or a route. The provider audit of 2026-09-26 (provider-smoke.yml, its
-- "Diagnose" step; docs/ai-provider-readiness.md) made real authenticated
-- requests to each. Every one authenticates; every one is blocked from serving
-- Visionex users by something outside this repository:
--
--   openrouter  Free models answer (text; tool calling on some). Paid models
--               refuse: "Key limit exceeded (total limit)", and the account
--               has no credits. Under $10 of purchased credits OpenRouter caps
--               free models at 50 requests a day and 20 a minute, account-wide.
--   nvidia-nim  Nine models answer (text, tools, JSON; one vision model). The
--               key is a build.nvidia.com trial key, and NVIDIA's FAQ limits
--               that catalogue to prototyping, development and testing:
--               serving real end-users needs an NVIDIA AI Enterprise licence.
--               Most listed ids answer 410 (end of life) or 404 (not on this
--               account) — the listing is not a list of what works.
--   bytez       The key authenticates (no key and a wrong key are 401), but
--               every model — including the one in Bytez's own documentation —
--               is "not in the Bytez catalog", and the model listing is empty
--               for this account.
--   fal         The key authenticates, and every submission is refused: "User
--               is locked. Reason: Exhausted balance."
--
-- So each row is 'inactive', which is what keeps it out of production:
-- resolveProvider() filters inactive rows, no chat/vision chain names these
-- providers, and since Phase 2J-1 no probe can move a row out of 'inactive' —
-- only an admin can. `config` carries what was verified and what blocks it, so
-- the row itself says why it is off. Activation is a later, deliberate change:
-- clear the blocker, re-run the workflow, then wire the capability.
--
-- `capabilities` stays empty, as on the chat/vision rows: capability is
-- per model, and the verified models and what each did are in config.
-- `cost_per_request` stays at its default: an invented number would feed the
-- router's score (see 20261036000000). Priority 90, below every established
-- row, as for RunPod.
--
-- ON CONFLICT DO NOTHING: a re-run changes nothing, and a row an admin has
-- since edited keeps the admin's values.

INSERT INTO public.ph_providers
  (name, slug, type, status, priority, api_key_ref, default_model, capabilities, is_system, config)
VALUES
  ('OpenRouter Chat', 'openrouter-chat', 'chat', 'inactive', 90, 'OPENROUTER_API_KEY', NULL, ARRAY[]::text[], true,
   jsonb_build_object(
     'production_eligible', false,
     'blocker', 'account: key total limit exhausted, no credits; free models capped at 50 requests/day',
     'blocker_kind', 'account',
     'verified_on', '2026-09-26',
     'verified_models', jsonb_build_object(
       'google/gemma-4-26b-a4b-it:free', jsonb_build_array('chat'),
       'nvidia/nemotron-3-super-120b-a12b:free', jsonb_build_array('chat'),
       'inclusionai/ling-3.0-flash-sante:free', jsonb_build_array('chat', 'tools'),
       'inclusionai/ling-3.0-flash-fin:free', jsonb_build_array('chat', 'tools')
     ),
     'refused', jsonb_build_object('paid models', 'http_403 key limit exceeded')
   )),
  ('NVIDIA NIM Chat', 'nvidia-nim-chat', 'chat', 'inactive', 90, 'NVIDIA_NIM_API_KEY', NULL, ARRAY[]::text[], true,
   jsonb_build_object(
     'production_eligible', false,
     'blocker', 'licence: build.nvidia.com trial catalogue is for development and testing only; production needs NVIDIA AI Enterprise',
     'blocker_kind', 'licence',
     'verified_on', '2026-09-26',
     'verified_models', jsonb_build_object(
       'google/gemma-4-31b-it', jsonb_build_array('chat', 'tools', 'json'),
       'openai/gpt-oss-20b', jsonb_build_array('chat', 'tools', 'json'),
       'moonshotai/kimi-k3', jsonb_build_array('chat', 'tools'),
       'meta/llama-3.2-11b-vision-instruct', jsonb_build_array('vision')
     ),
     'refused', jsonb_build_object('most listed ids', 'http_410 end of life / http_404 not on this account')
   )),
  ('Bytez Chat', 'bytez-chat', 'chat', 'inactive', 90, 'BYTEZ_API_KEY', NULL, ARRAY[]::text[], true,
   jsonb_build_object(
     'production_eligible', false,
     'blocker', 'account: key authenticates but no model is in this account''s Bytez catalog',
     'blocker_kind', 'account',
     'verified_on', '2026-09-26',
     'verified_models', '{}'::jsonb
   )),
  ('FAL Images', 'fal-image', 'image', 'inactive', 90, 'FAL_KEY', NULL, ARRAY[]::text[], true,
   jsonb_build_object(
     'production_eligible', false,
     'blocker', 'account: balance exhausted, user locked',
     'blocker_kind', 'account',
     'verified_on', '2026-09-26',
     'verified_models', '{}'::jsonb
   )),
  ('FAL Video', 'fal-video', 'text_to_video', 'inactive', 90, 'FAL_KEY', NULL, ARRAY[]::text[], true,
   jsonb_build_object(
     'production_eligible', false,
     'blocker', 'account: balance exhausted, user locked; video also has no VX price enabled',
     'blocker_kind', 'account',
     'verified_on', '2026-09-26',
     'verified_models', '{}'::jsonb
   ))
ON CONFLICT (slug) DO NOTHING;
