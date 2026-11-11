// The live part of the finance, simulator, community and account rows.

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanLabel,
  fetchRates,
  formatBoard,
  formatConversion,
  formatLeaderboard,
  formatRooms,
  formatSimulations,
  liveAppendix,
  LIVE_KEYS,
  LIVE_LANGUAGES,
  liveSay,
  parseLiveRequest,
  resetRatesCache,
  type LiveSources,
  type Rates,
} from "../../supabase/functions/_shared/whatsappSiteLive.ts";
import { SUPPORTED_LANGUAGES } from "../../supabase/functions/_shared/whatsappLanguages.ts";

const RATES: Rates = {
  updated: "2026-11-11",
  rates: { USD: 1, EUR: 0.9, GBP: 0.8, SAR: 3.75, AED: 3.6725, JOD: 0.709, KWD: 0.307, TRY: 34, EGP: 49, LBP: 89500 },
};

describe("wording", () => {
  it("has every sentence in all twenty languages", () => {
    expect([...LIVE_LANGUAGES].sort()).toEqual([...SUPPORTED_LANGUAGES].sort());
    for (const lang of SUPPORTED_LANGUAGES) {
      for (const key of LIVE_KEYS) expect(liveSay(key, lang).trim().length, `${lang}.${key}`).toBeGreaterThanOrEqual(1);
    }
  });

  it("only English is allowed to equal English for the long sentences", () => {
    for (const lang of SUPPORTED_LANGUAGES.filter((l) => l !== "en")) {
      expect(liveSay("fxUnavailable", lang), lang).not.toBe(liveSay("fxUnavailable", "en"));
    }
  });
});

describe("reading a quote request", () => {
  it.each([
    ["100 USD to EUR", { amount: 100, from: "USD", to: "EUR" }],
    ["100 usd in eur", { amount: 100, from: "USD", to: "EUR" }],
    ["convert 2,500 EUR to SAR", { amount: 2500, from: "EUR", to: "SAR" }],
    ["50 dollars to lbp", { amount: 50, from: "USD", to: "LBP" }],
    ["$20 to eur", { amount: 20, from: "USD", to: "EUR" }],
    ["١٠٠ دولار إلى يورو", { amount: 100, from: "USD", to: "EUR" }],
    ["كم 100 دولار بالليرة اللبنانية", { amount: 100, from: "USD", to: "LBP" }],
    ["500 ريال سعودي الى دينار اردني", { amount: 500, from: "SAR", to: "JOD" }],
  ])("%s", (text, want) => {
    expect(parseLiveRequest(text)).toEqual({ kind: "convert", ...want });
  });

  it("recognises a request for today's rates", () => {
    expect(parseLiveRequest("سعر الدولار")).toEqual({ kind: "board" });
    expect(parseLiveRequest("أسعار العملات")).toEqual({ kind: "board" });
    expect(parseLiveRequest("exchange rates")).toEqual({ kind: "board" });
  });

  it("leaves ordinary talk to the assistant", () => {
    for (const text of [
      "hello",
      "I paid 100 dollars for lunch yesterday and it was great",
      "100 usd",
      "usd to eur",
      "what is the weather in Amman",
      "100 abc to xyz",
      "100 usd to usd",
      "",
      null,
      undefined,
    ]) {
      expect(parseLiveRequest(text as string), String(text)).toBeNull();
    }
  });

  it("refuses an absurd amount and a long message", () => {
    expect(parseLiveRequest("99999999999999 usd to eur")).toBeNull();
    expect(parseLiveRequest(`100 usd to eur ${"x ".repeat(60)}`)).toBeNull();
  });
});

describe("formatting a quote", () => {
  it("converts through the dollar and prints both directions", () => {
    const text = formatConversion({ amount: 100, from: "EUR", to: "SAR", language: "en" }, RATES)!;
    expect(text).toContain("100 EUR = 416.67 SAR");
    expect(text).toContain("2026-11-11");
  });

  it("says the Lebanese pound is the official rate", () => {
    expect(formatConversion({ amount: 1, from: "USD", to: "LBP", language: "en" }, RATES)).toContain("official");
    expect(formatConversion({ amount: 1, from: "USD", to: "EUR", language: "en" }, RATES)).not.toContain("official");
  });

  it("returns null for a currency the service does not carry", () => {
    expect(formatConversion({ amount: 1, from: "USD", to: "ZZZ", language: "en" }, RATES)).toBeNull();
  });

  it("uses Latin digits in every language so a screen reader reads them the same way", () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      const text = formatConversion({ amount: 1234.5, from: "USD", to: "EUR", language: lang }, RATES)!;
      expect(text, lang).toMatch(/[0-9]/);
      expect(text, lang).not.toMatch(/[٠-٩۰-۹०-९০-৯]/);
    }
  });

  it("builds a board with the hint to send an amount", () => {
    const board = formatBoard("en", RATES)!;
    expect(board).toContain("EUR");
    expect(board).toContain(liveSay("fxHint", "en"));
  });
});

describe("fetching rates", () => {
  beforeEach(() => resetRatesCache());

  const ok = (body: unknown, status = 200) => vi.fn(async () => ({ ok: status < 400, json: async () => body })) as unknown as typeof fetch;

  it("reads a good answer and keeps it for ten minutes", async () => {
    const fetchFn = ok({ result: "success", time_last_update_unix: 1_762_819_200, rates: { USD: 1, EUR: 0.9, BAD: -1, usd: 5 } });
    const first = await fetchRates(fetchFn, 1000);
    expect(first?.rates).toEqual({ USD: 1, EUR: 0.9 });
    expect(first?.updated).toBe("2025-11-11");
    await fetchRates(fetchFn, 1000 + 5 * 60_000);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    await fetchRates(fetchFn, 1000 + 11 * 60_000);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("answers null on an error, a refusal or nonsense", async () => {
    expect(await fetchRates(ok({}, 500), 1)).toBeNull();
    expect(await fetchRates(ok({ result: "error" }), 1)).toBeNull();
    expect(await fetchRates(ok({ result: "success", rates: { EUR: 1 } }), 1)).toBeNull();
    expect(await fetchRates(vi.fn(async () => { throw new Error("offline"); }) as unknown as typeof fetch, 1)).toBeNull();
  });
});

describe("the other three lists", () => {
  it("shows the leaderboard, cleaned", () => {
    const text = formatLeaderboard(
      [
        { rank: 1, display_name: "Sara‮", total_points: 1200 },
        { rank: 2, display_name: null, total_points: "950" },
        { rank: 3, display_name: "x", total_points: "not a number" },
      ],
      "en",
    )!;
    expect(text).toContain("1. Sara — 1,200 pts");
    expect(text).toContain("2. — — 950 pts");
    expect(text).not.toContain("‮");
    expect(text).not.toContain("3.");
    expect(formatLeaderboard([], "en")).toBeNull();
    expect(formatLeaderboard("nope", "en")).toBeNull();
  });

  it("lists the published simulations and caps the list at ten", () => {
    const rows = Array.from({ length: 14 }, (_, i) => ({ title: `Sim ${i + 1}`, points: 50 }));
    const lines = formatSimulations(rows, "en")!.split("\n");
    expect(lines).toHaveLength(11);
    expect(lines[1]).toBe("• Sim 1 — 50 pts");
    expect(formatSimulations([{ title: "  " }], "en")).toBeNull();
  });

  it("lists open rooms, or says there are none", () => {
    expect(formatRooms([{ room_name: "Chess night" }], "en")).toContain("• Chess night");
    expect(formatRooms([], "en")).toContain(liveSay("roomsNone", "en"));
    expect(formatRooms(null, "ar")).toContain(liveSay("roomsNone", "ar"));
  });

  it("bounds and cleans what other people typed", () => {
    expect(cleanLabel("a\u0000b\n\nc‮d")).toBe("a b c d");
    expect(cleanLabel("x".repeat(100), 10)).toHaveLength(10);
    expect(cleanLabel(42)).toBe("");
  });
});

describe("the four rows", () => {
  const sources = (over: Partial<LiveSources> = {}): LiveSources => ({
    leaderboard: async () => [{ rank: 1, display_name: "Sara", total_points: 10 }],
    simulations: async () => [{ title: "Bakery", points: 30 }],
    rooms: async () => [],
    rates: async () => RATES,
    ...over,
  });

  it("gives each row its own live part", async () => {
    expect(await liveAppendix("more.account", "en", sources())).toContain("Sara");
    expect(await liveAppendix("explore.simulations", "en", sources())).toContain("Bakery");
    expect(await liveAppendix("headlines.community", "en", sources())).toContain(liveSay("roomsNone", "en"));
    expect(await liveAppendix("explore.finance", "en", sources())).toContain("EUR");
  });

  it("gives the other rows nothing", async () => {
    for (const id of ["explore.career", "bazaar.assistive", "explore.professional", "news"]) {
      expect(await liveAppendix(id, "en", sources()), id).toBe("");
    }
  });

  it("falls back to nothing when a source fails, so the sentence still goes out", async () => {
    const boom = async () => { throw new Error("db down"); };
    const broken = sources({ leaderboard: boom, simulations: boom, rooms: boom, rates: boom });
    for (const id of ["more.account", "explore.simulations", "headlines.community", "explore.finance"]) {
      expect(await liveAppendix(id, "en", broken), id).toBe("");
    }
    expect(await liveAppendix("explore.finance", "en", sources({ rates: async () => null }))).toBe("");
  });
});
