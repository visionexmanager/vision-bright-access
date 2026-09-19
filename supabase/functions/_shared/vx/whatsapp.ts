// The first consumer: a WhatsApp AI answer, billed centrally when it can be.
//
// Pure. No database client, no Deno, no provider — the two ports arrive as
// arguments, so every branch below is driven by a test rather than inferred
// from the source. The same seam `whatsappAsk.ts` uses for the model.
//
// ── What this decides ───────────────────────────────────────────────────────
//
// Whether one inbound message is billed from the central VX balance or from
// the legacy per-day count, and it decides that by *asking*, not by guessing.
// `vx_reserve_for_whatsapp` answers `not_linked` for a number with no account
// and `service_disabled` while the registry row is off — both of which mean
// "use the legacy path", and neither of which is an error.
//
// ── Why the legacy counter still runs ───────────────────────────────────────
//
// A centrally billed message still calls `whatsapp_meter`. The meter is an
// abuse counter, not a charge: it is what `whatsapp_entitlements` reads, what
// the repeat-message guard leans on, and what makes a runaway loop visible. A
// linked account is not charged twice — it is charged once, in VX, and counted
// once, for safety.

import type { ReserveResult, ServiceId, SettleResult } from "./types.ts";

/** What the webhook can do, handed in so the decision can be tested alone. */
export interface WhatsAppBillingPorts {
  /** `vx_reserve_for_whatsapp`. Never returns an identity. */
  reserve(args: {
    waPhone: string;
    serviceId: ServiceId;
    idempotencyKey: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<ReserveResult>;
  settle(args: {
    reservationId: string;
    consumedVx?: number | null;
    executionTimeMs?: number | null;
    provider?: string | null;
  }): Promise<SettleResult>;
  release(args: { reservationId: string; reason: string }): Promise<SettleResult>;
}

/** What the caller does next. */
export type BillingRoute =
  /** Central VX held. Run the work, then settle or release this reservation. */
  | { route: "central"; reservationId: string; reservedVx: number }
  /**
   * Use `maySpend()` / `whatsapp_meter` exactly as before. `why` is for the
   * log and is one of a fixed set — never a provider's sentence.
   */
  | { route: "legacy"; why: "not_linked" | "service_disabled" | "unavailable" }
  /** Refused outright, and the sender is told. Central VX, no fallback. */
  | { route: "refused"; reason: string; detail?: Record<string, unknown> };

/**
 * The reasons that mean "this number is not a central-billing customer".
 *
 * Both are ordinary states rather than faults: one is an unlinked number,
 * which is most of them, and the other is a capability nobody has switched on.
 * Anything else — no balance, a daily ceiling, a plan allowance — is a real
 * refusal that the sender has to hear about, because falling back to the free
 * quota there would hand them the thing they just could not afford.
 */
const FALL_BACK_TO_LEGACY = new Set(["not_linked", "service_disabled", "unknown_service"]);

/**
 * Decide how one message is paid for.
 *
 * Never throws: a billing lookup that fails takes the legacy path, because the
 * assistant going quiet over a metering fault is worse than a message that was
 * counted rather than charged. The opposite default — free on error — is how a
 * metering fault becomes a bill.
 */
export async function routeWhatsAppBilling(
  ports: WhatsAppBillingPorts,
  args: {
    waPhone: string;
    serviceId: ServiceId;
    /** Meta's `wa_message_id`. The webhook already dedupes on it. */
    messageId: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<BillingRoute> {
  let held: ReserveResult;
  try {
    held = await ports.reserve({
      waPhone: args.waPhone,
      serviceId: args.serviceId,
      // The message id is the idempotency key, so a Meta redelivery reserves
      // once. Without one, a redelivery would charge twice for one answer.
      idempotencyKey: args.messageId,
      metadata: args.metadata ?? {},
    });
  } catch {
    return { route: "legacy", why: "unavailable" };
  }

  if (held.ok === false) {
    if (FALL_BACK_TO_LEGACY.has(held.error)) {
      return {
        route: "legacy",
        why: held.error === "not_linked" ? "not_linked" : "service_disabled",
      };
    }
    const { ok: _ok, error, ...detail } = held;
    return { route: "refused", reason: error, detail: detail as Record<string, unknown> };
  }

  // A redelivery of a message whose answer was already billed and settled.
  // Answering again would be free and duplicated, which on this channel means
  // the sender gets the same reply twice.
  if (held.replayed && held.status && held.status !== "reserved") {
    return { route: "refused", reason: "already_answered" };
  }

  return { route: "central", reservationId: held.reservation_id, reservedVx: held.reserved_vx };
}

/**
 * Close a central reservation after the work finished or failed.
 *
 * Reported, never thrown, and never able to turn a delivered answer into a
 * failure: the sender already has their reply, and the scheduled reaper
 * returns the hold if this did not.
 */
export async function closeWhatsAppReservation(
  ports: WhatsAppBillingPorts,
  args: {
    reservationId: string;
    answered: boolean;
    executionTimeMs?: number;
    provider?: string;
  },
): Promise<"settled" | "released" | "unknown"> {
  try {
    if (!args.answered) {
      await ports.release({ reservationId: args.reservationId, reason: "no answer produced" });
      return "released";
    }
    await ports.settle({
      reservationId: args.reservationId,
      executionTimeMs: args.executionTimeMs ?? null,
      provider: args.provider ?? null,
    });
    return "settled";
  } catch {
    // The hold stands until the reaper sweeps it. Saying so is better than
    // reporting a settlement that did not happen.
    return "unknown";
  }
}
