// The edge half of the monthly realtime-minute allowance.
//
// The ceiling and the arithmetic live in `realtime_reserve` / `realtime_end`
// (migration 20261077). This file asks, and turns a "no" into a 429 that
// carries no cost, no plan and no provider — only that the month is spent.
//
// Takes the service client as an argument so Vitest can drive it with a stub;
// the RPCs are granted to `service_role` only.

export interface RealtimeMinutesClient {
  rpc(
    fn: "realtime_reserve" | "realtime_end",
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { code?: string } | null }>;
}

export const REALTIME_MONTHLY_MESSAGE = "Your monthly voice minutes are used up. They renew at the start of next month.";

export interface RealtimeReservation {
  /** null when the plan has no cap: nothing was recorded and nothing needs ending. */
  reservationId: string | null;
  /** Longest this session may run, in minutes; null when uncapped. */
  sessionMinutes: number | null;
  /** Minutes left in the month after this session's reservation; null when uncapped. */
  remainingMinutes: number | null;
}

const asInt = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : null);

/**
 * Reserve minutes for one session, or return the refusal to send instead.
 * Fails closed: an accounting system that cannot answer is not a reason to hand
 * out a paid provider session.
 */
export async function reserveRealtimeMinutes(
  client: RealtimeMinutesClient,
  userId: string,
  cors: Record<string, string>,
): Promise<{ ok: true; reservation: RealtimeReservation } | { ok: false; response: Response }> {
  let data: Record<string, unknown> | null = null;
  try {
    const res = await client.rpc("realtime_reserve", { _user_id: userId });
    if (res.error) console.error("[realtime-session] minute reservation failed:", res.error.code ?? "unknown");
    else if (res.data && typeof res.data === "object") data = res.data as Record<string, unknown>;
  } catch {
    console.error("[realtime-session] minute reservation threw");
  }

  const refuse = (status: number, error: string, extra: Record<string, string> = {}) => ({
    ok: false as const,
    response: new Response(JSON.stringify({ error }), {
      status,
      headers: { ...cors, "Content-Type": "application/json", ...extra },
    }),
  });

  if (!data) return refuse(503, "Voice sessions are unavailable right now. Please try again shortly.");
  if (data.allowed !== true) {
    return refuse(429, REALTIME_MONTHLY_MESSAGE, { "X-Limit-Reason": "realtime_monthly_minutes" });
  }
  if (data.capped !== true) {
    return { ok: true, reservation: { reservationId: null, sessionMinutes: null, remainingMinutes: null } };
  }
  const id = typeof data.reservation_id === "string" ? data.reservation_id : null;
  const minutes = asInt(data.reserved_minutes);
  if (!id || minutes === null || minutes < 1) {
    return refuse(503, "Voice sessions are unavailable right now. Please try again shortly.");
  }
  return { ok: true, reservation: { reservationId: id, sessionMinutes: minutes, remainingMinutes: asInt(data.remaining_minutes) } };
}

/** Tell the server a session is over (or never started). Best effort: a failure keeps the full reservation. */
export async function endRealtimeSession(
  client: RealtimeMinutesClient,
  userId: string,
  reservationId: string,
  failed = false,
): Promise<boolean> {
  try {
    const res = await client.rpc("realtime_end", { _user_id: userId, _reservation_id: reservationId, _failed: failed });
    if (res.error) return false;
    const d = res.data as { ended?: unknown } | null;
    return d?.ended === true;
  } catch {
    return false;
  }
}
