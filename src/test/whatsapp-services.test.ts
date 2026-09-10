// The Service Center, over WhatsApp.
//
// The claim this file has to hold up is narrow and worth stating plainly:
// every service the site sells can be reached from a chat window, in every
// language, without a second catalogue existing anywhere. So the assertions
// are of three kinds — the directory agrees with the site's catalogue, every
// service is actually reachable by pressing rows, and no message it builds is
// one Meta will reject.
//
// The last one is not pedantry. Meta truncates nothing: a list with eleven
// rows, or a row title of twenty-five characters, is refused outright and the
// sender is left staring at silence. A directory of fifty-five services in
// twenty languages is exactly where that goes wrong.

import { describe, expect, it } from "vitest";
import { buildServicesIndex } from "@/features/servicecenter/servicesIndex";
import { SERVICE_CATALOG } from "@/features/servicecenter/catalog";

const services = await import("../../supabase/functions/_shared/whatsappServices.ts");
const interactive = await import("../../supabase/functions/_shared/whatsappInteractive.ts");
const catalog = await import("../../supabase/functions/_shared/whatsappCatalog.ts");
const languages = await import("../../supabase/functions/_shared/whatsappLanguages.ts");
const strings = await import("../../supabase/functions/_shared/whatsappStrings.ts");
const engine = await import("../../supabase/functions/_shared/whatsappEngine.ts");
const sessions = await import("../../supabase/functions/_shared/whatsappSession.ts");

const LANGS = languages.SUPPORTED_LANGUAGES;
const LIMITS = catalog.LIST_LIMITS;

/** Every list this feature can produce, in one language. */
const everyList = (language: (typeof LANGS)[number]) => [
  ["hubs", interactive.servicesHubsMessage({ language })] as const,
  ...services.hubs().flatMap((hub) => {
    const pages = Math.ceil(services.servicesInHub(hub).length / services.SERVICE_PAGE_SIZE);
    return Array.from({ length: pages }, (_, page) =>
      [`${hub}#${page}`, interactive.servicesHubMessage({ hub, page, language })] as const);
  }),
  [
    "matches",
    interactive.servicesMatchesMessage({ services: services.SERVICES.slice(0, 3), language }),
  ] as const,
];

/**
 * The list inside a message, narrowed.
 *
 * Every one of these is a list rather than a button message, and that is worth
 * asserting rather than casting past: three or fewer rows would otherwise be
 * rendered as buttons, and a hub with three services in it is one service away
 * from silently changing shape.
 */
function listOf(message: { interactive: { type: string } }) {
  expect(message.interactive.type).toBe("list");
  return (message.interactive as {
    type: "list";
    action: { button: string; sections: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }> };
  }).action;
}

// ── The directory is the site's catalogue, not a copy of it ─────────────────

describe("one catalogue, read from where it already lives", () => {
  it("carries every service the site sells", () => {
    expect(services.SERVICES).toHaveLength(SERVICE_CATALOG.length);
    expect(services.SERVICES.map((s) => s.id)).toEqual(SERVICE_CATALOG.map((e) => e.slug));
  });

  it("reads the same snapshot the site's own search reads", () => {
    // Not "a snapshot with the same contents" — the same file. If this drifts,
    // `services-index.test.ts` fails first and says how to regenerate it.
    expect(services.SERVICES).toEqual(buildServicesIndex());
  });

  it("keeps every field this channel renders", () => {
    for (const service of services.SERVICES) {
      expect(service.id, service.id).toBeTruthy();
      expect(service.title_en, service.id).toBeTruthy();
      expect(service.title_ar, service.id).toBeTruthy();
      expect(service.hub, service.id).toBeTruthy();
      expect(service.path, `${service.id} path`).toMatch(/^\//);
    }
  });

  it("declares no service words of its own", () => {
    // The module ships no keyword list: it matches against the retrieval string
    // the indexer already builds. A hand-maintained list here would be the
    // second catalogue this whole design exists to avoid.
    const source = readModule();
    expect(source).not.toMatch(/keywords\s*[:=]\s*\[/);
  });
});

function readModule(): string {
  // Read rather than imported, because what is being asserted is what the file
  // says, not what it exports.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("node:fs").readFileSync(
    "supabase/functions/_shared/whatsappServices.ts",
    "utf8",
  ) as string;
}

// ── Everything is reachable ──────────────────────────────────────────────────

describe("every service can actually be pressed", () => {
  it("puts every service in a hub that is offered", () => {
    const offered = new Set(services.hubs());
    for (const service of services.SERVICES) {
      expect(offered.has(service.hub), `${service.id} in ${service.hub}`).toBe(true);
    }
  });

  it("offers no empty hub", () => {
    for (const hub of services.hubs()) {
      expect(services.servicesInHub(hub).length, hub).toBeGreaterThan(0);
    }
  });

  it("reaches every service by paging, and reaches each one once", () => {
    const seen: string[] = [];
    for (const hub of services.hubs()) {
      let page = 0;
      for (;;) {
        const current = services.hubPage(hub, page);
        seen.push(...current.services.map((s) => s.id));
        if (!current.hasMore) break;
        page += 1;
        expect(page, `${hub} paging`).toBeLessThan(50); // a runaway "more" row
      }
    }
    expect(seen.sort()).toEqual(services.SERVICES.map((s) => s.id).sort());
  });

  it("clamps a page number from a list sent by an older deployment", () => {
    const hub = services.hubs()[0];
    const last = Math.ceil(services.servicesInHub(hub).length / services.SERVICE_PAGE_SIZE) - 1;
    expect(services.hubPage(hub, 9999).page).toBe(last);
    expect(services.hubPage(hub, -3).page).toBe(0);
    expect(services.hubPage(hub, Number.NaN).page).toBe(0);
    expect(services.hubPage(hub, 9999).services.length).toBeGreaterThan(0);
  });

  it("says nothing about a hub it does not have", () => {
    expect(services.servicesInHub("no-such-hub")).toEqual([]);
    expect(services.hubPage("no-such-hub", 0).services).toEqual([]);
    expect(services.hubPage("no-such-hub", 0).hasMore).toBe(false);
  });
});

// ── Row ids ──────────────────────────────────────────────────────────────────

describe("a tapped row says exactly what was tapped", () => {
  it("round-trips every hub and every page", () => {
    for (const hub of services.hubs()) {
      for (const page of [0, 1, 7]) {
        expect(services.parseHubSelection(services.hubRowId(hub, page))).toEqual({ hub, page });
      }
    }
  });

  it("round-trips every service", () => {
    for (const service of services.SERVICES) {
      expect(services.parseServiceSelection(services.serviceRowId(service.id))).toBe(service.id);
    }
  });

  it("refuses a row id that is not one of these", () => {
    for (const id of ["", "news.abc", "main_menu", "explore.services", "svc.hub.", "svc.item."]) {
      expect(services.parseServiceSelection(id), id).toBeNull();
    }
    for (const id of ["", "news.abc", "svc.item.x", "svc.hub.", "svc.hub.marketplace"]) {
      expect(services.parseHubSelection(id), id).toBeNull();
    }
    expect(services.parseHubSelection("svc.hub.marketplace.-1")).toBeNull();
    expect(services.parseHubSelection(null)).toBeNull();
    expect(services.parseServiceSelection(undefined)).toBeNull();
  });

  it("keeps a hub id containing a dot readable", () => {
    // The page is split off the *last* dot, so a hub named "a.b" survives.
    expect(services.parseHubSelection("svc.hub.a.b.2")).toEqual({ hub: "a.b", page: 2 });
  });
});

// ── Search ───────────────────────────────────────────────────────────────────

describe("finding a service by saying what you need", () => {
  const findsIt = (query: string, slug: string) => {
    const found = services.searchServices(query).map((s) => s.id);
    expect(found, `${query} -> ${found.join(", ")}`).toContain(slug);
  };

  it("finds the services somebody would ask for, in English", () => {
    findsIt("delivery", "svc-delivery");
    findsIt("nutrition", "svc-nutrition");
    findsIt("I need a lawyer", "svc-legal");
  });

  it("finds them in Arabic too", () => {
    findsIt("توصيل", "svc-delivery");
    findsIt("بدي محامي", "svc-legal");
    findsIt("تغذية", "svc-nutrition");
  });

  it("matches a whole word, not a fragment inside another one", () => {
    // Under a `\b` regex — which is defined on ASCII — «طب» matches inside
    // «مطبخ». This is the case that made the matcher hand-written.
    const inside = services.searchServices("طب").map((s) => s.id);
    const kitchen = services.SERVICES.find((s) => s.text.includes("مطبخ"));
    if (kitchen && !kitchen.text.includes(" طب ")) {
      expect(inside).not.toContain(kitchen.id);
    }
  });

  it("answers nothing rather than everything when there is nothing to go on", () => {
    for (const query of ["", "   ", "بدي", "I need", "the", "a"]) {
      expect(services.searchServices(query), query).toEqual([]);
    }
  });

  it("returns the same list for the same question, every time", () => {
    const once = services.searchServices("delivery courier").map((s) => s.id);
    const twice = services.searchServices("delivery courier").map((s) => s.id);
    expect(once).toEqual(twice);
  });

  it("never returns more than a list has room for", () => {
    const many = services.searchServices("business", 99);
    expect(many.length).toBeLessThanOrEqual(services.SERVICES.length);
    expect(services.searchServices("business").length)
      .toBeLessThanOrEqual(services.SERVICE_MATCH_LIMIT);
  });
});

describe("the words that open the directory", () => {
  it("opens on its own name, typed in any of the twenty", () => {
    for (const language of LANGS) {
      const node = catalog.nodeById("explore.services")!;
      const words = catalog.aliasesOf(node, language);
      expect(words.length, language).toBeGreaterThan(0);
      for (const word of words) {
        expect(services.parseServicesRequest(word), `${language}: ${word}`).toBe(true);
      }
    }
  });

  it("does not open on a sentence that merely contains the word", () => {
    for (
      const sentence of [
        "your delivery service lost my parcel and nobody has called me back",
        "خدمة التوصيل تأخرت كثيراً ولم يتصل بي أحد حتى الآن",
        "",
      ]
    ) {
      expect(services.parseServicesRequest(sentence), sentence).toBe(false);
    }
  });
});

// ── What a sender actually receives ─────────────────────────────────────────

describe("the message a service becomes", () => {
  const paid = services.SERVICES.find((s) => typeof s.vx === "number" && s.vx > 0)!;

  it("names the service, its page, and how to reach a person", () => {
    const message = services.formatService({ service: paid, language: "en" });
    expect(message).toContain(paid.title_en);
    expect(message).toContain(`https://visionex.app${paid.path}`);
    expect(message).toContain(strings.say("serviceBookHint", "en"));
  });

  it("answers in Arabic when that is the language", () => {
    const message = services.formatService({ service: paid, language: "ar" });
    expect(message).toContain(paid.title_ar);
    expect(message).not.toContain(paid.title_en);
  });

  it("falls back to the site's English rather than to an empty line", () => {
    // Eighteen languages have no service titles, because the site wrote none.
    const message = services.formatService({ service: paid, language: "tr" });
    expect(message).toContain(paid.title_en);
    expect(services.serviceText(paid, "tr").title).toBe(paid.title_en);
  });

  it("says what a session costs, and says nothing when it is free", () => {
    expect(services.formatService({ service: paid, language: "en" }))
      .toContain(String(paid.vx));
    const free = { ...paid, vx: null };
    expect(services.formatService({ service: free, language: "en" }))
      .not.toContain(strings.say("serviceCost", "en").replace("{vx} VX", ""));
  });

  it("leaves no placeholder standing, in any language", () => {
    for (const language of LANGS) {
      const message = services.formatService({ service: paid, language });
      expect(message, language).not.toMatch(/\{[a-z]+\}/i);
    }
  });

  it("builds an absolute link, because a chat cannot follow a relative one", () => {
    for (const service of services.SERVICES) {
      expect(services.serviceUrl(service), service.id).toMatch(/^https:\/\/visionex\.app\//);
    }
  });
});

describe("no message this builds is one Meta will refuse", () => {
  it("keeps every list inside ten rows, in every language", () => {
    for (const language of LANGS) {
      for (const [name, message] of everyList(language)) {
        const rows = listOf(message).sections.flatMap((section) => section.rows);
        expect(rows.length, `${name}/${language}`).toBeLessThanOrEqual(LIMITS.rows);
        expect(rows.length, `${name}/${language}`).toBeGreaterThan(0);
      }
    }
  });

  it("keeps every label inside its own limit, in every language", () => {
    for (const language of LANGS) {
      for (const [name, message] of everyList(language)) {
        const action = listOf(message);
        expect([...action.button].length, `button/${name}/${language}`)
          .toBeLessThanOrEqual(LIMITS.button);
        for (const section of action.sections) {
          for (const row of section.rows) {
            // Code points, which is how `clip` and the rest of the suite
            // measure: an emoji is one character to a reader and two UTF-16
            // units to `.length`, and Meta's limit is the former.
            expect([...row.title].length, `${row.id}/${name}/${language}`)
              .toBeLessThanOrEqual(LIMITS.rowTitle);
            expect(row.title.trim().length, `${row.id}/${name}/${language}`).toBeGreaterThan(0);
            if (row.description) {
              expect([...row.description].length, `${row.id} desc/${name}/${language}`)
                .toBeLessThanOrEqual(LIMITS.rowDescription);
            }
          }
        }
      }
    }
  });

  it("gives every list a way back out", () => {
    // A list with no way out is a trap for somebody who cannot see the screen.
    for (const language of LANGS) {
      for (const [name, message] of everyList(language)) {
        const ids = listOf(message).sections.flatMap((s) => s.rows.map((r) => r.id));
        expect(ids, `${name}/${language}`).toContain(interactive.MAIN_MENU_ID);
      }
    }
  });

  it("carries a text twin for the sender outside the interactive window", () => {
    for (const language of LANGS) {
      for (const [name, message] of everyList(language)) {
        expect(message.text.trim().length, `${name}/${language}`).toBeGreaterThan(0);
        expect(message.text, `${name}/${language}`).not.toMatch(/\{[a-z]+\}/i);
      }
    }
  });

  it("keeps the full title in the twin when the row had to clip it", () => {
    const long = services.SERVICES.find((s) => s.title_en.length > LIMITS.rowTitle);
    if (!long) return;
    const message = interactive.servicesMatchesMessage({ services: [long], language: "en" });
    expect(message.text).toContain(long.title_en);
  });
});

describe("the door on the menu", () => {
  it("is a row somebody can find, under a menu that fits", () => {
    const node = catalog.nodeById("explore.services");
    expect(node).toBeTruthy();
    expect(node!.enabled).toBe(true);
    expect(node!.hidden).toBeFalsy();
    // Offered, not merely declared: a row past its parent's ten-row ceiling has
    // never been rendered and cannot have been tapped.
    const offered = catalog.offeredChildrenOf("explore").map((child) => child.id);
    expect(offered).toContain("explore.services");
  });

  it("names itself in every language, inside a row's limits", () => {
    for (const language of LANGS) {
      const node = catalog.nodeById("explore.services")!;
      const title = catalog.localized(node.title, language);
      const description = catalog.localized(node.description, language);
      expect([...title].length, language).toBeLessThanOrEqual(LIMITS.rowTitle);
      expect([...description].length, language).toBeLessThanOrEqual(LIMITS.rowDescription);
      expect(title.trim().length, language).toBeGreaterThan(0);
    }
  });
});

// ── The route in, through the engine that actually routes it ────────────────

describe("the engine hands this feature the right messages", () => {
  const NOW = Date.parse("2026-09-10T12:00:00Z");
  const ALL = new Set(["ai", "vision", "speech_to_text", "text_to_speech", "location", "bazaar"]);
  const ctx = () => ({
    language: "en" as const,
    nowMs: NOW,
    timeoutMs: 30 * 60_000,
    available: ALL as never,
    isNewConversation: false,
  });
  const live = () => ({
    ...sessions.freshSession(),
    updatedAt: new Date(NOW - 60_000).toISOString(),
  });

  it("delegates the row as an opening, so the areas are what goes out", () => {
    const outcome = engine.runEngine(
      { text: "", kind: "interactive", selection: "explore.services" },
      live(),
      ctx() as never,
    );
    expect(outcome.kind).toBe("delegate");
    if (outcome.kind !== "delegate") return;
    expect(outcome.node.id).toBe("explore.services");
    expect(outcome.node.handler).toBe("services");
    expect(outcome.reason).toBe("selection");
  });

  it("delegates the next sentence as a search, not as an opening", () => {
    // This is the whole search path: standing in the directory, what somebody
    // types has to arrive here as a delegate that is *not* an opening, or the
    // webhook would show them the areas again instead of answering.
    const opened = engine.runEngine(
      { text: "", kind: "interactive", selection: "explore.services" },
      live(),
      ctx() as never,
    );
    expect(opened.kind).toBe("delegate");
    if (opened.kind !== "delegate") return;

    const typed = engine.runEngine(
      { text: "I need a lawyer", kind: "text" },
      opened.session,
      ctx() as never,
    );
    expect(typed.kind).toBe("delegate");
    if (typed.kind !== "delegate") return;
    expect(typed.node.id).toBe("explore.services");
    expect(typed.reason).toBe("inside_feature");

    // And the words that arrive do find the service.
    expect(services.searchServices("I need a lawyer").map((s) => s.id)).toContain("svc-legal");
  });

  it("still lets the way out out", () => {
    const opened = engine.runEngine(
      { text: "", kind: "interactive", selection: "explore.services" },
      live(),
      ctx() as never,
    );
    if (opened.kind !== "delegate") throw new Error("expected a delegate");
    const back = engine.runEngine(
      { text: "", kind: "interactive", selection: interactive.MAIN_MENU_ID },
      opened.session,
      ctx() as never,
    );
    // Leaving is the engine's job, not this feature's: it must not be
    // swallowed as a search for a service called "main menu".
    expect(back.kind).toBe("reply");
  });
});
