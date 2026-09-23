// The first consumer: a WhatsApp AI answer, billed centrally when it can be.
//
// The service is disabled, so none of this runs in production yet. These drive
// every branch with functions, so "it works" is a property rather than a hope.

import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import {
  closeWhatsAppReservation,
  routeWhatsAppBilling,
  type WhatsAppBillingPorts,
} from "../../supabase/functions/_shared/vx/whatsapp.ts";
import type { ReserveResult } from "../../supabase/functions/_shared/vx/types.ts";

const migration = readFileSync("supabase/migrations/20261029000000_vx_whatsapp_reserve.sql", "utf8");
const registry = readFileSync("supabase/migrations/20261023000000_vx_central_pricing_and_ledger.sql", "utf8");

function ports(reserve: () => Promise<ReserveResult>, overrides: Partial<WhatsAppBillingPorts> = {}) {
  const calls: string[] = [];
  return {
    calls,
    ports: {
      reserve: vi.fn(async () => { calls.push("reserve"); return reserve(); }),
      settle: vi.fn(async () => { calls.push("settle"); return { ok: true, status: "settled" as const }; }),
      release: vi.fn(async () => { calls.push("release"); return { ok: true, status: "failed" as const }; }),
      ...overrides,
    } as WhatsAppBillingPorts,
  };
}

const ask = (p: WhatsAppBillingPorts, messageId: string | null = "wamid.1") =>
  routeWhatsAppBilling(p, { waPhone: "96170000000", serviceId: "whatsapp_ai", messageId });

describe("which population a sender belongs to", () => {
  it("bills a linked sender centrally", async () => {
    const p = ports(async () => ({ ok: true, replayed: false, reservation_id: "res-1", reserved_vx: 2 }));
    expect(await ask(p.ports)).toEqual({ route: "central", reservationId: "res-1", reservedVx: 2 });
  });

  it("sends an unlinked number back to the legacy quota, not to a refusal", async () => {
    // Most numbers are unlinked. This is an ordinary state, not a fault, and
    // it must not read as one.
    const p = ports(async () => ({ ok: false, error: "not_linked" }));
    expect(await ask(p.ports)).toEqual({ route: "legacy", why: "not_linked" });
  });

  it("sends everybody back to the legacy quota while the service is disabled", async () => {
    // Which is how it ships, and is why wiring this changes nothing today.
    const p = ports(async () => ({ ok: false, error: "service_disabled" }));
    expect(await ask(p.ports)).toEqual({ route: "legacy", why: "service_disabled" });
  });

  it("falls back rather than going silent when billing is unreachable", async () => {
    const p = ports(async () => { throw new Error("database unreachable"); });
    expect(await ask(p.ports)).toEqual({ route: "legacy", why: "unavailable" });
  });
});

describe("a real refusal is not a free answer", () => {
  it("refuses instead of falling back when the sender cannot afford it", async () => {
    // Falling back here would hand them the thing they just could not pay for.
    for (const error of ["insufficient_vx", "daily_ceiling_reached", "plan_allowance_reached", "admin_only"] as const) {
      const p = ports(async () => ({ ok: false, error }));
      expect(await ask(p.ports), error).toMatchObject({ route: "refused", reason: error });
    }
  });

  it("carries the numbers the sender needs to hear", async () => {
    const p = ports(async () => ({ ok: false, error: "insufficient_vx", balance: 1, required: 2, shortage: 1 }));
    expect(await ask(p.ports)).toEqual({
      route: "refused", reason: "insufficient_vx",
      detail: { balance: 1, required: 2, shortage: 1 },
    });
  });
});

describe("a redelivered message is answered once", () => {
  it("uses the message id as the idempotency key", async () => {
    const p = ports(async () => ({ ok: true, replayed: false, reservation_id: "r", reserved_vx: 2 }));
    await ask(p.ports, "wamid.abc");
    expect(p.ports.reserve).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: "wamid.abc" }));
  });

  it("finishes a reservation the first attempt left open", async () => {
    // The first attempt reserved and then crashed before answering. The
    // redelivery should produce the answer, not refuse.
    const p = ports(async () => ({ ok: true, replayed: true, reservation_id: "r", reserved_vx: 2, status: "reserved" }));
    expect(await ask(p.ports)).toMatchObject({ route: "central", reservationId: "r" });
  });

  it("refuses to answer the same message twice once it is settled", async () => {
    const p = ports(async () => ({ ok: true, replayed: true, reservation_id: "r", reserved_vx: 2, status: "settled" }));
    expect(await ask(p.ports)).toEqual({ route: "refused", reason: "already_answered" });
  });
});

describe("closing the reservation", () => {
  it("settles when an answer went out", async () => {
    const p = ports(async () => ({ ok: true, replayed: false, reservation_id: "r", reserved_vx: 2 }));
    expect(await closeWhatsAppReservation(p.ports, { reservationId: "r", answered: true, provider: "openai" })).toBe("settled");
    expect(p.calls).toContain("settle");
  });

  it("releases the whole hold when no answer was produced", async () => {
    const p = ports(async () => ({ ok: true, replayed: false, reservation_id: "r", reserved_vx: 2 }));
    expect(await closeWhatsAppReservation(p.ports, { reservationId: "r", answered: false })).toBe("released");
    expect(p.calls).toContain("release");
    expect(p.calls).not.toContain("settle");
  });

  it("never turns a delivered answer into a failure", async () => {
    const p = ports(
      async () => ({ ok: true, replayed: false, reservation_id: "r", reserved_vx: 2 }),
      { settle: async () => { throw new Error("database unreachable"); } },
    );
    // The sender already has their reply; the reaper returns the hold.
    expect(await closeWhatsAppReservation(p.ports, { reservationId: "r", answered: true })).toBe("unknown");
  });
});

describe("the webhook never learns who the sender is", () => {
  it("resolves the identity inside the database and returns no user id", () => {
    expect(migration).toContain("SELECT i.user_id INTO _user_id");
    expect(migration).toContain("RETURN _result - 'user_id'");
    expect(migration).toContain("never a user id");
  });

  it("refuses an unlinked number rather than inventing a subject", () => {
    expect(migration).toContain("'error', 'not_linked'");
    expect(migration).not.toMatch(/INSERT INTO (public\.)?auth\.users/i);
    expect(migration).not.toMatch(/INSERT INTO public\.whatsapp_identities/i);
  });

  it("is service-role only", () => {
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.vx_reserve_for_whatsapp(text, text, text, integer, jsonb)\n  FROM PUBLIC, anon, authenticated;");
    expect(migration).toContain("TO service_role;");
  });
});

describe("the service is still off", () => {
  it("ships whatsapp_ai disabled, so wiring this changes nothing", () => {
    const seed = registry.slice(
      registry.indexOf("INSERT INTO public.central_pricing_registry"),
      registry.indexOf("ON CONFLICT (service_id) DO NOTHING"),
    );
    expect(seed).toContain("('whatsapp_ai',");
    expect(seed).not.toMatch(/\benabled\b/);
  });
});
