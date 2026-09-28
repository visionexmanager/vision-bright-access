// Writing one metered provider call: price it from the book, insert the event.
//
// Free of npm imports so Vitest can drive it with a stub client (usageMeter.ts
// supplies the real one). Counts, ids and dollars only — never a prompt, an
// answer or a user's content.

import { costOf, priceFor, PRICE_UNITS, type PriceRow, type UsageEvent } from "./metering.ts";

/** The two calls this module makes. A supabase-js client satisfies it. */
export interface UsageDb {
  from(table: string): {
    select(columns: string): PromiseLike<{ data: unknown; error: unknown }>;
    insert(row: Record<string, unknown>): PromiseLike<{ error: unknown }>;
  };
}

/** How long a function trusts its copy of the price book. */
export const PRICE_BOOK_TTL_MS = 10 * 60_000;

const FUNCTION_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;

let cache: { rows: PriceRow[]; at: number } | null = null;
let loading: Promise<PriceRow[]> | null = null;

/** For tests: forget the cached price book. */
export function resetPriceBookCache(): void {
  cache = null;
  loading = null;
}

function validRow(r: unknown): r is PriceRow {
  const row = r as Partial<PriceRow> | null;
  return !!row && typeof row.id === "number" && typeof row.provider === "string" && typeof row.model_id === "string" &&
    (PRICE_UNITS as readonly string[]).includes(String(row.unit)) && !!row.rates && typeof row.rates === "object" &&
    typeof row.effective_from === "string" && (row.effective_to === null || typeof row.effective_to === "string");
}

/**
 * The whole price book, cached per isolate. It is a few dozen rows; one read
 * every ten minutes is cheaper than one per call. A failed read keeps the last
 * good copy, or none — and an event with no price is recorded "unpriced".
 */
export async function priceBook(db: UsageDb, now: number = Date.now()): Promise<PriceRow[]> {
  if (cache && now - cache.at < PRICE_BOOK_TTL_MS) return cache.rows;
  loading ??= (async () => {
    try {
      const { data, error } = await db.from("ai_price_book")
        .select("id, provider, model_id, unit, rates, effective_from, effective_to");
      if (error || !Array.isArray(data)) return cache?.rows ?? [];
      const rows = data.filter(validRow);
      cache = { rows, at: now };
      return rows;
    } catch {
      return cache?.rows ?? [];
    } finally {
      loading = null;
    }
  })();
  return loading;
}

/** Price one event and write it to ai_usage_events. Never throws. */
export async function recordUsageEventIn(
  db: UsageDb,
  functionName: string,
  event: UsageEvent,
  now: number = Date.now(),
): Promise<void> {
  try {
    if (!FUNCTION_NAME.test(functionName)) return;
    const occurredAt = new Date(now).toISOString();
    const row = priceFor(await priceBook(db, now), event.provider, event.model, event.resolved_model, occurredAt);
    const cost = costOf(event.usage, row);
    await db.from("ai_usage_events").insert({
      occurred_at: occurredAt,
      function_name: functionName,
      operation: event.operation,
      provider: event.provider,
      model: event.model,
      resolved_model: event.resolved_model ?? null,
      chain_id: event.chain_id ?? null,
      reservation_id: event.reservation_id ?? null,
      attempt: event.attempt ?? null,
      outcome: event.outcome,
      error_code: event.error_code ?? null,
      usage: event.usage ?? {},
      usage_source: event.usage_source,
      price_id: "price_id" in cost ? cost.price_id ?? null : null,
      provider_cost_usd: cost.status === "priced" || cost.status === "free" ? cost.cost_usd : null,
      cost_status: cost.status,
      cost_note: cost.status === "unpriced" ? cost.reason : null,
    });
  } catch {
    // Metering never reaches the request.
  }
}
