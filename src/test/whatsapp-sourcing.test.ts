// Asking the catalogue when the bazaar has nothing.
//
// `bazaar_products` is what shops have listed. `products` is the Visionex
// catalogue, and the Commerce Agent searches it properly. The agent has taken a
// `channel` field since it was written and nothing ever passed it "whatsapp",
// so a sender whose thing no shop happened to list was told "nothing found"
// while the same question on the website reached an agent.
//
// What is pinned here: that a customer sees the customer-facing projection and
// nothing behind it, that "could not reach" and "there is nothing" stay
// different sentences, and that all twenty languages can say both.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  CATALOGUE_URL,
  MAX_OFFERS,
  conditionLabel,
  formatOfferPrice,
  formatSourcedOffers,
  readSourcedOffers,
  sourcingNoneNotice,
  sourcingUnavailableNotice,
  type SourcedOffer,
} from "../../supabase/functions/_shared/whatsappSourcing.ts";
import { SUPPORTED_LANGUAGES } from "../../supabase/functions/_shared/whatsappLanguages.ts";

/** A response shaped the way `sourcing/handler.ts` returns one. */
const agentResponse = (over: Partial<Record<"new" | "used" | "refurbished", unknown[]>> = {}) => ({
  results: {
    new: over.new ?? [],
    used: over.used ?? [],
    refurbished: over.refurbished ?? [],
  },
  total: 0,
  searchedExternally: false,
});

const offer = (over: Partial<Record<string, unknown>> = {}) => ({
  ref: "VX-000123",
  title: "Braille label maker",
  brand: "Perkins",
  model: "PLM-2",
  category: "accessibility",
  specifications: {},
  condition: "new",
  availability: "in_stock",
  priceUsd: 149.5,
  currency: "USD",
  ...over,
});

describe("reading what the agent returned", () => {
  it("flattens new, then used, then refurbished", () => {
    // Somebody who did not name a condition means a new one; the cheaper
    // alternatives belong underneath rather than instead.
    const parsed = readSourcedOffers(agentResponse({
      new: [offer({ ref: "VX-1", title: "A" })],
      used: [offer({ ref: "VX-2", title: "B", condition: "used" })],
      refurbished: [offer({ ref: "VX-3", title: "C", condition: "refurbished" })],
    }));
    expect(parsed.map((entry) => entry.ref)).toEqual(["VX-1", "VX-2", "VX-3"]);
    expect(parsed.map((entry) => entry.condition)).toEqual(["new", "used", "refurbished"]);
  });

  it("drops an offer that cannot be described or ordered", () => {
    // No title is nothing to say; no ref is nothing to ask for.
    const parsed = readSourcedOffers(agentResponse({
      new: [
        offer({ ref: "", title: "Untitled" }),
        offer({ title: "" }),
        "not an object",
        null,
        offer({ ref: "VX-ok" }),
      ],
    }));
    expect(parsed.map((entry) => entry.ref)).toEqual(["VX-ok"]);
  });

  it("returns nothing for a shape it does not recognise", () => {
    expect(readSourcedOffers(null)).toEqual([]);
    expect(readSourcedOffers({})).toEqual([]);
    expect(readSourcedOffers({ results: "no" })).toEqual([]);
    expect(readSourcedOffers({ results: { new: "no" } })).toEqual([]);
  });

  it("keeps a missing price as absent rather than as zero", () => {
    // "0 USD" is a claim. No price is not.
    const [parsed] = readSourcedOffers(agentResponse({ new: [offer({ priceUsd: null })] }));
    expect(parsed.priceUsd).toBeNull();
    expect(formatOfferPrice(parsed, "en")).toBeNull();
  });

  it("falls back to the group's condition when the row does not say", () => {
    const [parsed] = readSourcedOffers(agentResponse({ used: [offer({ condition: undefined })] }));
    expect(parsed.condition).toBe("used");
  });
});

describe("what reaches the customer", () => {
  it("carries only the customer-facing fields", () => {
    // Supplier identity, source price and the margin live in `sourcing_results`,
    // admin-read only. `confidentiality.ts` is the allow-list; this checks that
    // nothing slipped past it into a message.
    const parsed = readSourcedOffers(agentResponse({
      new: [{
        ...offer(),
        // Fields the projection would never emit — present here to prove that
        // even if one did, it does not reach a sender.
        sourceSlug: "secret-supplier",
        sourcePriceUsd: 40,
        pricingBreakdown: { margin: 109.5 },
        sourceProductId: "internal-99",
      }],
    }));

    const message = formatSourcedOffers({ language: "en", offers: parsed });
    for (const secret of ["secret-supplier", "internal-99", "margin", "40"]) {
      expect(message, secret).not.toContain(secret);
    }
    expect(Object.keys(parsed[0]).sort()).toEqual(
      ["availability", "brand", "condition", "currency", "priceUsd", "ref", "title"],
    );
  });

  it("shows the source's name only when the projection supplied one", () => {
    // Some sources require the credit by their terms. That decision is made in
    // `confidentiality.ts`; this only renders what it passed through.
    const credited = readSourcedOffers(agentResponse({ new: [offer({ sourceName: "OpenLibrary" })] }));
    expect(formatSourcedOffers({ language: "en", offers: credited })).toContain("OpenLibrary");

    const plain = readSourcedOffers(agentResponse({ new: [offer()] }));
    expect(plain[0].sourceName).toBeUndefined();
  });

  it("shows the reference, which is how a person asks for one", () => {
    const parsed = readSourcedOffers(agentResponse({ new: [offer()] }));
    expect(formatSourcedOffers({ language: "en", offers: parsed })).toContain("VX-000123");
  });

  it("keeps the list short enough to be read aloud", () => {
    // Ten offers read out is not a choice, it is a wall — and this panel's
    // audience frequently cannot see the screen.
    const many = Array.from({ length: 10 }, (_, i) => offer({ ref: `VX-${i}`, title: `Item ${i}` }));
    const message = formatSourcedOffers({
      language: "en",
      offers: readSourcedOffers(agentResponse({ new: many })),
    });
    expect(MAX_OFFERS).toBe(4);
    expect(message.match(/VX-\d/g) ?? []).toHaveLength(MAX_OFFERS);
  });

  it("puts the name and price before the code on every line", () => {
    // A screen reader should reach what the thing is before its reference —
    // that is the order somebody decides in.
    const parsed = readSourcedOffers(agentResponse({ new: [offer()] }));
    const line = formatSourcedOffers({ language: "en", offers: parsed })
      .split("\n").find((l) => l.startsWith("•")) ?? "";
    expect(line).toContain("Braille label maker");
    expect(line).not.toContain("VX-000123");
  });

  it("writes the price in Latin digits, in every language", () => {
    // Prices get copied, compared and read back to a shopkeeper, so the digits
    // are Latin everywhere — including in Arabic, Persian and Bengali, whose
    // own numerals a shopkeeper may not read.
    //
    // The decimal separator is left to the locale: "149,5" is simply how
    // Indonesian writes it, and forcing a full stop there would be wrong.
    const parsed = readSourcedOffers(agentResponse({ new: [offer()] }));
    for (const language of SUPPORTED_LANGUAGES) {
      const price = formatOfferPrice(parsed[0], language) ?? "";
      expect(price, language).toContain("USD");
      expect(price, language).toMatch(/149/);
      // No Arabic-Indic, Extended Arabic-Indic, Devanagari or Bengali digits.
      expect(price, language).not.toMatch(/[\u0660-\u0669\u06f0-\u06f9\u0966-\u096f\u09e6-\u09ef]/);
    }
  });
});

describe("the two different silences", () => {
  it("says 'there is nothing' and 'I could not reach it' differently", () => {
    // Telling somebody their thing does not exist, when really the agent was
    // down, is a lie that costs them a search somewhere else.
    for (const language of SUPPORTED_LANGUAGES) {
      const none = sourcingNoneNotice(language);
      const broken = sourcingUnavailableNotice(language);
      expect(none, language).not.toBe(broken);
      expect(none, language).toContain(CATALOGUE_URL);
      expect(broken, language).toContain(CATALOGUE_URL);
      expect(none, language).not.toContain("{url}");
      expect(broken, language).not.toContain("{url}");
    }
  });

  it("renders an empty offer list as the honest nothing", () => {
    expect(formatSourcedOffers({ language: "en", offers: [] })).toBe(sourcingNoneNotice("en"));
  });
});

describe("all twenty languages", () => {
  it("has its own words for every notice, with no English fallback", () => {
    const english = {
      none: sourcingNoneNotice("en"),
      broken: sourcingUnavailableNotice("en"),
    };
    for (const language of SUPPORTED_LANGUAGES) {
      if (language === "en") continue;
      expect(sourcingNoneNotice(language), language).not.toBe(english.none);
      expect(sourcingUnavailableNotice(language), language).not.toBe(english.broken);
    }
  });

  it("names all three conditions everywhere", () => {
    for (const language of SUPPORTED_LANGUAGES) {
      const labels = (["new", "used", "refurbished"] as const)
        .map((condition) => conditionLabel(condition, language));
      for (const label of labels) expect(label.trim().length, language).toBeGreaterThan(0);
      // Three conditions a buyer chooses between must not read identically.
      expect(new Set(labels).size, language).toBe(3);
    }
  });
});

describe("the webhook's part", () => {
  const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");

  it("asks the catalogue only after the bazaar found nothing", () => {
    const branch = webhook.slice(webhook.indexOf("if (scored.length > 0)"));
    const miss = branch.indexOf("bazaarRequest.confident");
    const ask = branch.indexOf("sourceFromCatalogue(");
    expect(ask).toBeGreaterThan(miss);
  });

  it("leaves a weak guess to the assistant rather than searching a catalogue", () => {
    // Searching because somebody said "do you have a minute" is worse than not
    // searching. The fall-through that existed before is untouched.
    const branch = webhook.slice(webhook.indexOf("if (scored.length > 0)"));
    const fallThrough = branch.indexOf("bazaarFellThrough = true");
    expect(branch.indexOf("sourceFromCatalogue(")).toBeLessThan(fallThrough);
  });

  it("tells the agent which channel it is", () => {
    expect(webhook).toContain('channel: "whatsapp"');
  });

  it("keeps 'unreachable' distinct all the way through", () => {
    const helper = webhook.slice(webhook.indexOf("const sourceFromCatalogue"));
    const body = helper.slice(0, helper.indexOf("};"));
    // null on failure, [] on an empty answer — never the same value.
    expect(body).toContain("return null;");
    expect(body).toContain("return [];");
  });

  it("logs a status, never the query or the agent's words", () => {
    const helper = webhook.slice(webhook.indexOf("const sourceFromCatalogue"));
    const body = helper.slice(0, helper.indexOf("};"));
    const logs = body.match(/console\.(log|error|warn)\([^;]*\)/g) ?? [];
    expect(logs.length).toBeGreaterThan(0);
    for (const line of logs) {
      expect(line, line).not.toMatch(/trimmed|query|await response|body/);
    }
  });

  it("passes nothing about the sender to the agent", () => {
    // A phone number is not an account, and the agent records what it is given.
    const helper = webhook.slice(webhook.indexOf("const sourceFromCatalogue"));
    const body = helper.slice(0, helper.indexOf("};"));
    expect(body).not.toContain("incoming.from");
    expect(body).not.toContain("Authorization");
  });
});
