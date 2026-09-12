// What every Visionex booking has in common, whatever is being booked.
//
// A taxi and a flight are different products with the same skeleton: somebody
// asks, several suppliers answer with prices that expire, one answer is chosen,
// an unambiguous yes is required, and money moves. The parts of that skeleton
// which do not care what is being booked live here.
//
// It exists because the second booking domain arrived. `mobility.ts` had grown
// a `Money`, a confirmation rule and a concurrent-gather with per-supplier
// deadlines, and flights needed the same three. Importing them from a module
// called "mobility" would have been a lie about what they are, and copying them
// would have been two confirmation rules — which is one confirmation rule and
// one bug waiting for somebody to fix only the other.
//
// `mobility.ts` re-exports everything here, so nothing that already imported
// from it had to change.
//
// Pure. No `Deno`, no fetch, no database client.

// ── Money ───────────────────────────────────────────────────────────────────
//
// Minor units and a currency, never a float. A fare is compared, summed and
// stored; `18.50` in binary floating point is none of those things reliably,
// and a currency that is not carried beside its amount is a number that will
// eventually be added to a different one.

export interface Money {
  /** Minor units — cents, fils, pence. Never a decimal fraction. */
  amount: number;
  /** ISO 4217, uppercase. */
  currency: string;
}

export const money = (amount: number, currency: string): Money => ({
  amount: Math.round(amount),
  currency: currency.toUpperCase(),
});

/**
 * Two prices are comparable only inside one currency.
 *
 * Ranking across currencies would need a rate, a rate has an age, and a stale
 * rate silently reorders a list somebody is about to spend money from. So a
 * mixed-currency list is grouped rather than converted, and the caller decides
 * what to show.
 */
export const sameCurrency = (a: Money, b: Money): boolean => a.currency === b.currency;

/** A fare, in the currency the supplier quoted and never converted silently. */
export function formatMoney(value: Money, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: value.currency,
    }).format(value.amount / 100);
  } catch {
    return `${(value.amount / 100).toFixed(2)} ${value.currency}`;
  }
}

// ── Confirmation ────────────────────────────────────────────────────────────
//
// A booking spends somebody's money. It happens on an unambiguous yes and on
// nothing else — not on a hedge, not on a question, and not on silence.

const YES = /^(yes|yeah|yep|ok|okay|sure|confirm|confirmed|book it|book|do it|go ahead|please do)$/i;
const YES_AR = /^(نعم|أجل|اجل|اوك|أوكي|تمام|أكد|اكد|أكيد|اكيد|احجز|احجزها|موافق|موافقة|يلا|ماشي)$/;

/**
 * Whether this message is a yes.
 *
 * Whole message only, and a deliberately short list. "Maybe", "I think so" and
 * "how much again?" are all not-a-yes, and the cost of reading one of them as
 * consent is a charge somebody did not agree to. When this returns false the
 * caller asks again — which is cheap — rather than booking, which is not.
 */
export function isExplicitConfirmation(text: string | null | undefined): boolean {
  const value = (text ?? "").trim().replace(/^[\s.!،,]+|[\s.!،,]+$/g, "");
  if (!value || [...value].length > 24) return false;
  return YES.test(value) || YES_AR.test(value);
}

// ── Asking several suppliers at once ────────────────────────────────────────

export interface GatherResult<T> {
  results: T[];
  failed: Array<{ slug: string; code: string }>;
}

/**
 * Ask every supplier at once and keep whoever answers in time.
 *
 * Concurrent, because four suppliers asked one after another is four timeouts
 * somebody waits through. **A deadline each**, because one slow answer must not
 * cost the others theirs — the failure this repository has already been bitten
 * by once, in the AI provider chain, where a single shared budget let one
 * hanging call starve every fallback behind it.
 *
 * A supplier that throws or times out contributes nothing and is reported
 * separately. It never takes the search down: a list of three is an answer, and
 * an error page is not.
 */
export async function gatherFrom<T>(
  sources: ReadonlyArray<{ slug: string; run: () => Promise<T[]> }>,
  timeoutMs: number,
  codeOf: (error: unknown) => string,
): Promise<GatherResult<T>> {
  const settled = await Promise.all(
    sources.map(async ({ slug, run }) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const deadline = new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new DeadlineExceeded(slug)), timeoutMs);
        });
        return { slug, results: await Promise.race([run(), deadline]), code: null as string | null };
      } catch (error) {
        return { slug, results: [] as T[], code: codeOf(error) };
      } finally {
        if (timer !== undefined) clearTimeout(timer);
      }
    }),
  );

  return {
    results: settled.flatMap((one) => one.results),
    failed: settled
      .filter((one) => one.code !== null)
      .map((one) => ({ slug: one.slug, code: one.code as string })),
  };
}

/** Thrown by `gatherFrom` when a supplier runs past its own deadline. */
export class DeadlineExceeded extends Error {
  readonly slug: string;
  constructor(slug: string) {
    super("DEADLINE_EXCEEDED");
    this.name = "DeadlineExceeded";
    this.slug = slug;
  }
}

// ── Names, as a supplier will accept them ───────────────────────────────────

/**
 * A name with its accents folded onto Latin letters.
 *
 * «José» becomes "Jose" and not "Jos". Folding rather than stripping matters
 * because the alternative loses a letter, and a name with a letter missing
 * fails at ticketing or at a front desk — after the money has been taken.
 *
 * Only the fold is shared. What each domain then *allows* is its own rule: an
 * airline will not print an apostrophe on a boarding pass and a hotel folio is
 * perfectly happy with O'Brien, so `ticketName` and `guestName` differ after
 * this point and are both right.
 */
export function foldLatin(value: string | null | undefined): string {
  return (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// ── Local time in somebody else's zone ──────────────────────────────────────

/**
 * A local wall-clock string in a zone, as a UTC instant in milliseconds.
 *
 * Returns NaN for anything unparseable, which every caller checks. The zone is
 * applied by asking what the offset was *at that moment* rather than now: a
 * flight on the far side of a daylight-saving change has a different offset
 * from today's, and using today's is how a two-hour flight becomes a
 * three-hour one twice a year. A hotel's free-cancellation deadline has the
 * same problem and the same answer.
 *
 * Shared because both domains need it and two copies would drift.
 */
export function localToInstant(local: string, timezone: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec((local ?? "").trim());
  if (!match) return Number.NaN;

  const [, y, mo, d, h, mi] = match;
  // First read the wall clock as if it were UTC, then correct by the zone's
  // offset at approximately that instant. One correction is enough: an offset
  // is never large enough to move the instant into a different offset period,
  // outside of changes no airline schedules across.
  const asUtc = Date.parse(`${y}-${mo}-${d}T${h}:${mi}:00Z`);
  if (!Number.isFinite(asUtc)) return Number.NaN;

  try {
    const shown = new Date(asUtc).toLocaleString("en-US", { timeZone: timezone });
    const back = new Date(shown).getTime();
    const utcShown = new Date(new Date(asUtc).toLocaleString("en-US", { timeZone: "UTC" })).getTime();
    if (!Number.isFinite(back) || !Number.isFinite(utcShown)) return Number.NaN;
    return asUtc - (back - utcShown);
  } catch {
    // An unknown zone must not take a search down. UTC is wrong but readable,
    // and the supplier's own times still render.
    return asUtc;
  }
}


// ── Prices that expire ──────────────────────────────────────────────────────

/**
 * Whether a quoted price can still be acted on.
 *
 * Every supplier price in this codebase carries an `expiresAt` and it is never
 * optional. A price with no expiry is one nobody can be held to, and the
 * difference matters most where it is shortest: an air fare can lapse between
 * being shown and being chosen.
 */
export function isFresh(expiresAt: string, nowMs: number): boolean {
  const expiry = Date.parse(expiresAt);
  return Number.isFinite(expiry) && expiry > nowMs;
}

/** Seconds until a price lapses, floored at zero. For "expires in 4:31". */
export function secondsUntilExpiry(expiresAt: string, nowMs: number): number {
  const expiry = Date.parse(expiresAt);
  if (!Number.isFinite(expiry)) return 0;
  return Math.max(0, Math.floor((expiry - nowMs) / 1000));
}
