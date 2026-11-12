// The seven site sections that had no door on WhatsApp, and the rules a door must obey.

import { describe, expect, it } from "vitest";
import { CATALOG, childrenOf, nodeById } from "../../supabase/functions/_shared/whatsappCatalog.ts";
import { PARITY_NODES } from "../../supabase/functions/_shared/whatsappParityNodes.ts";
import { SUPPORTED_LANGUAGES } from "../../supabase/functions/_shared/whatsappLanguages.ts";

const IDS = PARITY_NODES.map((n) => n.id);

describe("site sections on WhatsApp", () => {
  it("adds exactly the seven missing sections, each under its own group", () => {
    expect(Object.fromEntries(PARITY_NODES.map((n) => [n.id, n.parent]))).toEqual({
      "explore.career": "explore",
      "explore.simulations": "explore",
      "explore.finance": "explore",
      "headlines.community": "headlines",
      "bazaar.assistive": "bazaar",
      "more.account": "more",
      "explore.professional": "explore",
    });
    for (const n of PARITY_NODES) expect(nodeById(n.parent)).not.toBeNull();
  });

  it("has no duplicate ids and keeps every list within Meta's ten rows", () => {
    const ids = CATALOG.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const n of CATALOG) if (n.kind === "menu") expect(childrenOf(n.id).length, n.id).toBeLessThanOrEqual(10);
  });

  it("writes every title, description and sentence in all twenty languages, inside Meta's limits", () => {
    for (const n of PARITY_NODES) {
      for (const lang of SUPPORTED_LANGUAGES) {
        const title = n.title[lang];
        const description = n.description[lang];
        expect(title, `${n.id} ${lang} title`).toBeTruthy();
        expect(description, `${n.id} ${lang} description`).toBeTruthy();
        expect(`${title} ${n.emoji}`.length, `${n.id} ${lang} title length`).toBeLessThanOrEqual(24);
        expect(description!.length, `${n.id} ${lang} description length`).toBeLessThanOrEqual(72);
        const intro = n.intro?.[lang];
        expect(intro, `${n.id} ${lang} intro`).toBeTruthy();
        expect(intro, `${n.id} ${lang} link`).toContain("https://visionex.app/");
      }
    }
  });

  it("opens the assistant for careers and assistive products, and answers the rest with a sentence and an address", () => {
    const handlers = Object.fromEntries(PARITY_NODES.map((n) => [n.id, n.handler]));
    expect(handlers).toEqual({
      "explore.career": "ai_ask",
      "explore.simulations": "info",
      "explore.finance": "info",
      "headlines.community": "info",
      "bazaar.assistive": "ai_ask",
      "more.account": "info",
      "explore.professional": "info",
    });
    expect(IDS.filter((id) => nodeById(id)?.requires?.includes("ai"))).toEqual(["explore.career", "bazaar.assistive"]);
  });
});
