-- OpenRouter joins the free providers' chain.
--
-- The owner asked for it on 2026-11-05 without raising the key's cap, so the
-- constraints stay as they were and are the reason it sits late:
--   * the key's total limit is $0, so every paid model answers 403;
--   * under $10 of purchased credit, free models are capped at 50 requests a
--     day and 20 a minute for the whole account.
-- It is a safety net behind Groq, Cerebras, Gemini and Mistral, never a lead.
--
-- Chosen from the live sweep of 2026-11-05 (provider-smoke, scope=all): a free
-- model published by NVIDIA, answered text in 1.9 s. Gemma 4 answered 429 on
-- every probe that day. Only models from a recognised publisher are listed:
-- free endpoints may log prompts, and the senders here are private.
--
-- Chat only. No tool calling was verified for the model, so a structured
-- request (which needs "tools") never reaches it.
--
-- Rollback: UPDATE ph_providers SET status = 'inactive' WHERE slug = 'openrouter-chat';

UPDATE public.ph_providers
SET status = 'active',
    default_model = 'nvidia/nemotron-3.5-lightning:free',
    config = coalesce(config, '{}'::jsonb) || jsonb_build_object(
      'production_eligible', true,
      'blocker', 'cap: key total limit $0 (paid models 403); free models 50 requests/day until $10 of credit is bought',
      'blocker_kind', 'account',
      'verified_on', '2026-11-05',
      'verified_models', jsonb_build_object(
        'nvidia/nemotron-3.5-lightning:free', jsonb_build_array('chat')
      )
    )
WHERE slug = 'openrouter-chat';
