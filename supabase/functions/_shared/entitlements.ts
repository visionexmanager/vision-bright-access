// Does this account's plan open this section? Asked server-side, every time.
//
// `PlanGate` answers the same question in the browser, and that is the right
// place to answer it for *rendering* — a locked section should look locked
// without a round trip. It is the wrong place to answer it for *permission*,
// because the browser is the one thing the caller controls. An account on Basic
// with a valid session can call a Business-only Edge Function directly and,
// until this existed, be served.
//
// The VX meter is not this check. It asks whether the caller can pay for a unit
// of work; this asks whether their plan includes the service at all. A Basic
// subscriber holding VX passes the first and must still fail the second.
//
// The answer comes from `user_has_section`, which resolves the plan by the same
// order the WhatsApp entitlement reader uses, so the two surfaces cannot drift
// into disagreeing about who is on what.

/** The sections a plan can open. Mirrors SectionKey in src/lib/billing/plans.ts. */
export type Section =
  | "assistant" | "academy" | "library" | "arcade" | "kids" | "career"
  | "marketplace" | "community" | "news" | "assistive" | "tv" | "radio"
  | "messages" | "simulations" | "mediaStudio" | "studio" | "professional"
  | "finance";

/** Just enough of a Supabase client to ask, so this stays testable. */
export interface EntitlementDb {
  rpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
}

export interface SectionVerdict {
  allowed: boolean;
  /** Present when the answer could not be obtained rather than being "no". */
  unavailable?: boolean;
}

/**
 * Ask whether `userId` may use `section`.
 *
 * `db` must hold the service role: `user_has_section` is revoked from anon and
 * authenticated precisely so a browser cannot ask it about somebody else.
 *
 * A failed lookup refuses. That is the opposite of how the *rendering* path
 * fails — an unreadable plan there falls back to the free sections so nobody is
 * locked out of the news — and deliberately so: on this side the cost of being
 * wrong is giving away the expensive thing, not hiding the free one.
 */
export async function maySeeSection(
  db: EntitlementDb,
  userId: string,
  section: Section,
): Promise<SectionVerdict> {
  const { data, error } = await db.rpc("user_has_section", {
    _user_id: userId,
    _section: section,
  });
  if (error) return { allowed: false, unavailable: true };
  return { allowed: data === true };
}

/**
 * The refusal an Edge Function should send. 403 rather than 402: the account is
 * not short of VX, the plan does not include this at all, and the thing to do
 * about it is upgrade rather than top up.
 *
 * The body names the section and where to go, and nothing else — not the plan
 * the caller is on, not what the service costs Visionex, not which vendor runs
 * it.
 */
export function sectionRefusal(section: Section, unavailable = false): Response {
  const body = unavailable
    ? {
        ok: false,
        error: "entitlement_unavailable",
        message: "We could not confirm your plan just now. Please try again in a moment.",
      }
    : {
        ok: false,
        error: "plan_required",
        section,
        upgrade_url: "https://visionex.app/pricing",
        message: "Your plan does not include this service yet.",
      };
  return new Response(JSON.stringify(body), {
    status: unavailable ? 503 : 403,
    headers: { "Content-Type": "application/json" },
  });
}
