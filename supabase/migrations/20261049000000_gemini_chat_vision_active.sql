-- Gemini's chat and vision rows become 'active'.
--
-- 20261042000000 seeded them 'inactive' because the key was recorded as
-- unfunded (2026-08-11) and "a row says what is known". What is known changed:
-- on 2026-09-26 the provider smoke test (.github/workflows/provider-smoke.yml)
-- generated with the production GEMINI_API_KEY — the same value the Edge
-- Function runtime holds, compared by digest — and gemini-flash-latest and
-- gemini-flash-lite-latest both answered text, image and JSON-schema requests.
--
-- It matters now because the chat/vision chains read these rows: an inactive
-- row sends its provider to the back of every chain (aiProvider.orderTargets).
-- Left inactive, a working provider that the policy places second would be
-- tried last.
--
-- Only rows still 'inactive' move, so an admin who has since set 'error' or
-- 'degraded' by hand is not overridden, and a re-run changes nothing. Health is
-- raised to at least 50 — the floor the probe restores (Phase 2J-1) — so a
-- score driven down while the account was unfunded does not demote at once.

UPDATE public.ph_providers
SET status       = 'active',
    health_score = GREATEST(health_score, 50),
    updated_at   = now()
WHERE slug IN ('gemini-chat', 'gemini-vision')
  AND status = 'inactive';
