// The vocabulary the website, WhatsApp and a future API client all use.
//
// Pure: no Deno, no database client, no fetch. It is imported by the app's
// TypeScript project as well as by Edge Functions, which is why it must stay
// that way — `aiProvider.ts` reads `Deno.env`, and anything that imports it
// drags Deno's globals into the build for everything else.

/**
 * Every billable capability, matching `central_pricing_registry.service_id`.
 *
 * A literal union rather than a free string: a typo in a service id is the one
 * mistake that cannot be caught at runtime, because `vx_reserve` answers
 * `unknown_service` and a caller that ignores the reply just does the work for
 * free. The registry may hold more rows than this; these are the ones code
 * names directly.
 */
export const SERVICE_IDS = [
  "ocr",
  "tts",
  "voice_clone",
  "image",
  "video",
  "translation",
  "whatsapp_ai",
  "document_ai",
] as const;

export type ServiceId = (typeof SERVICE_IDS)[number];

export function isServiceId(value: string): value is ServiceId {
  return (SERVICE_IDS as readonly string[]).includes(value);
}

/**
 * Where the request came from. This is the column that lets one ledger answer
 * "what did WhatsApp cost this month" without a second table — and the reason
 * there is no separate WhatsApp wallet.
 *
 * `system` is for work nobody asked for: the daily content proposals, a
 * scheduled re-index. It is still billed, so the cost is visible, but it is
 * not attributed to a person's own activity.
 */
export const USAGE_SOURCES = ["website", "whatsapp", "api", "system"] as const;

export type UsageSource = (typeof USAGE_SOURCES)[number];

export function isUsageSource(value: string): value is UsageSource {
  return (USAGE_SOURCES as readonly string[]).includes(value);
}

/** What `vx_reserve` answers. */
export type ReserveResult =
  | {
    ok: true;
    replayed: boolean;
    reservation_id: string;
    reserved_vx: number;
    free_units_used?: number;
    balance_after?: number;
    status?: string;
  }
  | {
    ok: false;
    error: ReserveRefusal;
    balance?: number;
    required?: number;
    shortage?: number;
    used_today?: number;
    max_daily_usage?: number;
    plan_allowance?: number;
  };

/**
 * Why a reservation was refused.
 *
 * Every one of these is a different thing for the caller to say to the person,
 * which is why they are codes and not one `false`. `insufficient_vx` offers a
 * top-up; `daily_ceiling_reached` says come back tomorrow; `service_disabled`
 * is not the user's problem at all and should read as "not available yet".
 */
export type ReserveRefusal =
  | "user_required"
  | "unknown_source"
  | "unknown_service"
  | "service_disabled"
  | "admin_only"
  | "daily_ceiling_reached"
  | "plan_allowance_reached"
  | "insufficient_vx"
  /**
   * Only from `vx_reserve_for_whatsapp`: the number has no linked account, so
   * there is no balance to reserve against. It is the commonest answer on that
   * channel and it is not a fault — the caller takes the legacy count-based
   * quota, which is what an unlinked number has always had.
   */
  | "not_linked";

/** What `vx_settle` and `vx_release` answer. */
export interface SettleResult {
  ok: boolean;
  replayed?: boolean;
  status?: "settled" | "failed" | "refunded" | "expired";
  consumed_vx?: number;
  refunded_vx?: number;
  balance_after?: number;
  error?: string;
}
