-- A registry row for the website AI chat (ai-chat), so it can be billed later
-- by configuration alone. Disabled, as every other service is: ai-chat runs
-- through vx/billing.ts, which runs a disabled service exactly as today.
--
-- pricing_mode 'metered': when the owner enables it, a chat is billed by the
-- provider cost its calls record, converted by vx_conversion_policy — which is
-- still empty, so even enabling this row alone could not charge anyone.
-- vx_price is 0 because a metered service does not use it; it is not a price.
--
-- Only inserted if absent: a row an admin has since edited is left alone.

INSERT INTO public.central_pricing_registry
  (service_id, display_name, provider, base_cost, vx_price, free_limit, plan_limits, max_daily_usage, enabled, pricing_mode, notes)
VALUES
  ('ai_chat', 'AI chat (website)', NULL, 0, 0, 0, '{}', NULL, false, 'metered',
   'Metered by provider cost (ai_usage_events) once enabled; needs a vx_conversion_policy row and, ideally, max_reserve_vx. Guests are never billed.')
ON CONFLICT (service_id) DO NOTHING;
