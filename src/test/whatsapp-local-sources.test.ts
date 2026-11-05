import { describe, expect, it } from "vitest";
import {
  asksForNews,
  currenciesIn,
  enabledFeeds,
  gatherSources,
  parseFeed,
  plainBullet,
} from "../../supabase/functions/_shared/whatsappLocalSources";
import { localChatMode, withLocalChat } from "../../supabase/functions/_shared/whatsappLocalChat";

const NOW = () => new Date("2026-11-05T09:00:00Z");

const RSS = `<?xml version="1.0"?><rss><channel><title>DW</title>
<item><title>Iran says three ships caught fire in the Strait of Hormuz</title><pubDate>Thu, 5 Nov 2026 07:36:00 GMT</pubDate><description><![CDATA[Tehran reports fires on two tankers &amp; a tug. More follows.]]></description></item>
<item><title>Football: league leaders win again</title><pubDate>Thu, 5 Nov 2026 06:00:00 GMT</pubDate><description>Sport.</description></item>
</channel></rss>`;

const EVENTS = `{{Current events|year=2026|month=11|day=4|top=yes}}
'''Business and economy'''
*The [[Bangladesh]]i [[Textile industry in Bangladesh|garment industry]] wage board agrees to raise [[minimum wage]]s after five days of protests. [https://www.afp.com/en/x (AFP)]

'''Disasters and accidents'''
*A [[cargo boat]] capsizes off [[Jomalig, Quezon]], [[Philippines]]. Seven people are missing.
*short`;

const ITN = `{{Main page image/ITN
| image = x.jpg
}}
*<!--Oct 31--> The [[Polish Constitutional Tribunal crisis (2015–2016)|Polish Constitutional Tribunal crisis]] escalates with '''the suspension''' of the tribunal's president.`;

const claim = (id: string, extra: Record<string, unknown> = {}) => ({
  rank: "normal", mainsnak: { datavalue: { value: { id } } }, ...extra,
});

/** One fake network that answers by host and action. Anything else is a 404. */
function network(overrides: Record<string, () => Response> = {}) {
  const calls: string[] = [];
  const impl = (async (input: string) => {
    const url = String(input);
    calls.push(url);
    const u = new URL(url);
    const key = `${u.hostname}${u.pathname}${u.searchParams.get("action") ? `?${u.searchParams.get("action")}` : ""}`;
    if (overrides[key]) return overrides[key]();
    if (u.hostname === "open.er-api.com") {
      return new Response(JSON.stringify({ result: "success", time_last_update_utc: "Thu, 05 Nov 2026 00:02:31 +0000", rates: { USD: 1, LBP: 89500, EUR: 0.8876 } }));
    }
    if (u.hostname === "www.wikidata.org" && u.searchParams.get("action") === "wbsearchentities") {
      return new Response(JSON.stringify({ search: [{ id: "Q822", label: "Lebanon", description: "country in West Asia" }] }));
    }
    if (u.hostname === "www.wikidata.org" && u.searchParams.get("action") === "wbgetentities" && u.searchParams.get("props") === "claims") {
      return new Response(JSON.stringify({ entities: { Q822: { claims: {
        P36: [claim("Q3820")],
        P35: [claim("Q363392", { qualifiers: { P582: [{}] } }), claim("Q29033962", { rank: "preferred" })],
        P6: [claim("Q296771", { qualifiers: { P582: [{}] } }), claim("Q111")],
        P1082: [
          { rank: "normal", mainsnak: { datavalue: { value: { amount: "+1804927" } } }, qualifiers: { P585: [{ datavalue: { value: { time: "+1970-00-00T00:00:00Z" } } }] } },
          { rank: "normal", mainsnak: { datavalue: { value: { amount: "+5593000" } } }, qualifiers: { P585: [{ datavalue: { value: { time: "+2022-00-00T00:00:00Z" } } }] } },
        ],
      } } } }));
    }
    if (u.hostname === "www.wikidata.org" && u.searchParams.get("props") === "labels") {
      return new Response(JSON.stringify({ entities: {
        Q3820: { labels: { en: { value: "Beirut" } } },
        Q29033962: { labels: { en: { value: "Joseph Aoun" } } },
        Q111: { labels: { en: { value: "Nawaf Salam" } } },
        Q296771: { labels: { en: { value: "Former PM" } } },
        Q363392: { labels: { en: { value: "Former President" } } },
      } }));
    }
    if (u.hostname === "en.wikipedia.org" && u.searchParams.get("action") === "parse") {
      const page = u.searchParams.get("page") ?? "";
      return new Response(JSON.stringify({ parse: { wikitext: page.startsWith("Template:") ? ITN : page.includes("November_5") ? "" : EVENTS } }));
    }
    if (u.hostname.endsWith("wikipedia.org") && u.searchParams.get("generator") === "search") {
      return new Response(JSON.stringify({ query: { pages: { "1": { index: 1, title: "Lebanon", touched: "2026-11-02T19:48:18Z", extract: "Lebanon is a country in West Asia. Its capital and largest city is Beirut, on the Mediterranean.", fullurl: "https://en.wikipedia.org/wiki/Lebanon" } } } }));
    }
    if (u.hostname === "rss.dw.com") return new Response(RSS);
    return new Response("nope", { status: 404 });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("reading the question", () => {
  it("recognises a request for news in several languages", () => {
    for (const q of ["what is the news today", "ما هي آخر أخبار إيران", "les actualités d'aujourd'hui", "noticias de hoy", "bugün haber var mı"]) {
      expect(asksForNews(q)).toBe(true);
    }
    expect(asksForNews("what is the capital of France")).toBe(false);
  });

  it("finds the currencies in a rate question, with Arabic prefixes", () => {
    expect(currenciesIn("كم سعر الدولار بالليرة اللبنانية")).toEqual(["USD", "LBP"]);
    expect(currenciesIn("what is the euro rate against the turkish lira")).toEqual(["EUR", "TRY"]);
    expect(currenciesIn("سعر الريال السعودي")).toEqual(["SAR"]);
    expect(currenciesIn("I like the dollar store")).toEqual([]);
  });

  it("only enables the feeds the switch names", () => {
    expect(enabledFeeds(() => undefined)).toEqual([]);
    expect(enabledFeeds((n) => (n === "LOCAL_CHAT_FEEDS" ? "dw-ar, nonsense ,BBC-World" : undefined))).toEqual(["dw-ar", "bbc-world"]);
  });
});

describe("parsing", () => {
  it("turns wikitext bullets into plain sentences", () => {
    expect(plainBullet("*The [[Bangladesh]]i [[Textile industry in Bangladesh|garment industry]] agrees. [https://x.org/a (AFP)]"))
      .toBe("The Bangladeshi garment industry agrees.");
    expect(plainBullet("*<!--Oct 31--> The '''big''' [[A|story]] <ref>x</ref>continues")).toBe("The big story continues");
  });

  it("reads a feed's items, decoding entities and dates", () => {
    const items = parseFeed(RSS);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ date: "2026-11-05" });
    expect(items[0].summary).toContain("two tankers & a tug");
  });
});

describe("gathering", () => {
  it("answers a rate question from the exchange source alone", async () => {
    const { impl, calls } = network();
    const out = await gatherSources({ question: "كم سعر الدولار بالليرة اللبنانية", language: "ar", fetchImpl: impl, now: NOW, read: () => undefined });
    expect(out!.text).toContain("1 USD = 89500 LBP (daily rate, 2026-11-05");
    expect(out!.used).toEqual({ "exchange-rates": 1 });
    expect(calls.every((u) => u.includes("open.er-api.com"))).toBe(true);
  });

  it("gives structured facts for a country, current ones only", async () => {
    const { impl } = network();
    const out = await gatherSources({ question: "Who is the president of Lebanon?", language: "en", fetchImpl: impl, now: NOW, read: () => undefined });
    expect(out!.text).toContain("[Wikidata] Lebanon (country in West Asia) — capital: Beirut; head of state: Joseph Aoun; head of government: Nawaf Salam; population: 5,593,000 (2022)");
    expect(out!.text).not.toContain("1,804,927");
    expect(out!.text).not.toContain("Former");
    expect(out!.used.wikidata).toBe(1);
    expect(out!.used.wikipedia).toBe(1);
  });

  it("answers a news question from the site, the feeds and current events, newest first", async () => {
    const { impl } = network();
    const out = await gatherSources({
      question: "what is the latest news today", language: "en", fetchImpl: impl, now: NOW,
      read: (n) => (n === "LOCAL_CHAT_FEEDS" ? "dw-en" : undefined),
      visionexNews: async () => [{ title: "Library extends hours", description: "Opens at eight.", date: "2026-11-05T05:00:00Z" }],
    });
    const lines = out!.text.split("\n");
    expect(lines[0]).toBe("[Visionex News, 2026-11-05] Library extends hours — Opens at eight.");
    expect(out!.text).toContain("[DW, 2026-11-05] Iran says three ships caught fire");
    // The budget is 500 characters, so the lines that come last in priority may not fit.
    expect(out!.text).not.toContain("short");
    expect(out!.text.length).toBeLessThanOrEqual(500);
  });

  it("reads current events and In the news when nothing else answers", async () => {
    const { impl } = network();
    const out = await gatherSources({ question: "what is the news today", language: "en", fetchImpl: impl, now: NOW, read: () => undefined });
    expect(out!.text).toContain("[Wikipedia current events, 2026-11-04] The Bangladeshi garment industry");
    expect(out!.text).toContain("Polish Constitutional Tribunal crisis escalates");
    expect(out!.text).not.toContain("short");
  });

  it("keeps only items about the topic when the question names one", async () => {
    const { impl } = network();
    const out = await gatherSources({
      question: "latest news on Iran", language: "en", fetchImpl: impl, now: NOW,
      read: (n) => (n === "LOCAL_CHAT_FEEDS" ? "dw-en" : undefined),
    });
    expect(out!.text).toContain("Iran says three ships");
    expect(out!.text).not.toContain("Football");
    expect(out!.text).not.toContain("Bangladeshi");
  });

  it("uses no feed unless one is switched on", async () => {
    const { impl, calls } = network();
    await gatherSources({ question: "what is the news today", language: "en", fetchImpl: impl, now: NOW, read: () => undefined });
    expect(calls.some((u) => u.includes("rss.dw.com"))).toBe(false);
  });

  it("does not search at all for a message with personal data", async () => {
    const { impl, calls } = network();
    expect(await gatherSources({ question: "news for sami@example.com today", fetchImpl: impl, read: () => undefined })).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("survives a source that fails, is slow, or returns rubbish", async () => {
    const { impl } = network({
      "open.er-api.com/v6/latest/USD": () => new Response("not json"),
      "www.wikidata.org/w/api.php?wbsearchentities": () => new Response("x", { status: 500 }),
    });
    const out = await gatherSources({ question: "capital of Lebanon", language: "en", fetchImpl: impl, now: NOW, read: () => undefined });
    expect(out!.used).toEqual({ wikipedia: 1 });
    const never = (async (_u: string, init: RequestInit) => new Promise((_res, rej) => init.signal!.addEventListener("abort", () => rej(new Error("aborted"))))) as unknown as typeof fetch;
    expect(await gatherSources({ question: "capital of Lebanon", language: "en", fetchImpl: never, now: NOW, read: () => undefined, timeoutMs: 30 })).toBeNull();
  });

  it("survives the site's news query throwing", async () => {
    const { impl } = network();
    const out = await gatherSources({
      question: "what is the news today", language: "en", fetchImpl: impl, now: NOW, read: () => undefined,
      visionexNews: async () => { throw new Error("db down"); },
    });
    expect(out!.used["visionex-news"]).toBeUndefined();
    expect(out!.used["current-events"]).toBeGreaterThan(0);
  });
});

describe("where the local model sits", () => {
  const config = { url: "https://example.test/internal/media", token: "t" };
  const request = { system: "rules", messages: [{ role: "user" as const, content: "what is the capital of Lebanon" }], maxTokens: 100 };
  const local = (async () => new Response(JSON.stringify({ ok: true, text: "Beirut.", ms: 1 }))) as unknown as typeof fetch;
  const readWith = (mode?: string) => (n: string) => (n === "LOCAL_CHAT" ? "on" : n === "LOCAL_CHAT_MODE" ? mode : undefined);

  it("treats anything but first or only as fallback", () => {
    expect(localChatMode(() => undefined)).toBe("fallback");
    expect(localChatMode(() => "FIRST")).toBe("first");
    expect(localChatMode(() => "only ")).toBe("only");
    expect(localChatMode(() => "off")).toBe("fallback");
    expect(localChatMode(() => "onlyy")).toBe("fallback");
  });

  it("fallback: the paid chain answers and the model is not asked", async () => {
    let asked = false;
    const fetchImpl = (async () => { asked = true; return new Response("{}"); }) as unknown as typeof fetch;
    const provider = withLocalChat(async () => ({ text: "paid", provider: "p", model: "m" }), { read: readWith(), fetchImpl, config });
    expect((await provider(request)).provider).toBe("p");
    expect(asked).toBe(false);
  });

  it("first: the model answers and the paid chain is not called", async () => {
    let paid = false;
    const provider = withLocalChat(async () => { paid = true; return { text: "paid", provider: "p", model: "m" }; }, { read: readWith("first"), fetchImpl: local, config });
    expect((await provider(request)).provider).toBe("local");
    expect(paid).toBe(false);
  });

  it("first: falls back to the paid chain when the model cannot answer", async () => {
    const busy = (async () => new Response("{}", { status: 503 })) as unknown as typeof fetch;
    const provider = withLocalChat(async () => ({ text: "paid", provider: "p", model: "m" }), { read: readWith("first"), fetchImpl: busy, config });
    expect((await provider(request)).provider).toBe("p");
  });

  it("only: the paid chain is never called, even when the model fails", async () => {
    let paid = false;
    const busy = (async () => new Response("{}", { status: 503 })) as unknown as typeof fetch;
    const provider = withLocalChat(async () => { paid = true; return { text: "paid", provider: "p", model: "m" }; }, { read: readWith("only"), fetchImpl: busy, config });
    expect((await provider(request)).text).toBe("");
    expect(paid).toBe(false);
  });
});

describe("the request the local model is actually sent", () => {
  const long = (n: number, ch = "س") => ch.repeat(n);
  const bigRequest = {
    system: "RULES ".repeat(900),
    messages: [
      { role: "user" as const, content: "SUMMARY " + long(3000) },
      { role: "user" as const, content: "first question " + long(900) },
      { role: "assistant" as const, content: "first answer " + long(900) },
      { role: "user" as const, content: long(900) + " ما هي عاصمة لبنان؟" },
    ],
    maxTokens: 700,
  };

  it("replaces the full system prompt with a small one that names the language", async () => {
    const { compactForLocal, localSystemPrompt } = await import("../../supabase/functions/_shared/whatsappLocalChat");
    const out = compactForLocal(bigRequest, "ar");
    expect(out.system).toBe(localSystemPrompt("ar"));
    expect(out.system).toContain("Reply in Arabic.");
    expect(out.system.length).toBeLessThan(260);
    expect(out.system).not.toContain("RULES");
    expect(localSystemPrompt("zz")).toContain("language of the question");
  });

  it("keeps the end of a long question and a short history, starting with the person", async () => {
    const { compactForLocal, LOCAL_HISTORY_CHARS } = await import("../../supabase/functions/_shared/whatsappLocalChat");
    const out = compactForLocal(bigRequest, "ar");
    expect(out.messages.at(-1)!.role).toBe("user");
    expect(out.messages.at(-1)!.content.endsWith("ما هي عاصمة لبنان؟")).toBe(true);
    expect(out.messages[0].role).toBe("user");
    expect(out.messages.reduce((n, m) => n + m.content.length, 0)).toBeLessThanOrEqual(LOCAL_HISTORY_CHARS + 250);
    expect(JSON.stringify(out)).not.toContain("SUMMARY");
  });

  it("asks for a short answer, and the whole prompt stays small enough to read in time", async () => {
    const { compactForLocal } = await import("../../supabase/functions/_shared/whatsappLocalChat");
    const out = compactForLocal(bigRequest, "ar");
    expect(out.maxTokens).toBe(100);
    // Arabic is ~2 characters a token and the model reads ~29 tokens a second:
    // about 1,200 characters including 500 of sources is ~350 tokens, ~12 s to read.
    const total = out.system.length + out.messages.reduce((n, m) => n + m.content.length, 0) + 500;
    expect(total).toBeLessThanOrEqual(1_200);
  });

  it("is what the model receives through withLocalChat", async () => {
    const { withLocalChat } = await import("../../supabase/functions/_shared/whatsappLocalChat");
    let body: { system: string; messages: unknown[]; max_tokens: number } | null = null;
    const fetchImpl = (async (_u: string, init: RequestInit) => {
      body = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ ok: true, text: "بيروت.", ms: 1 }));
    }) as unknown as typeof fetch;
    const provider = withLocalChat(async () => { throw new Error("x"); }, {
      read: (n) => (n === "LOCAL_CHAT" ? "on" : undefined), fetchImpl, language: "ar",
      config: { url: "https://example.test/internal/media", token: "t" },
    });
    await provider(bigRequest);
    expect(body!.system).toContain("Reply in Arabic.");
    expect(body!.system).not.toContain("RULES");
    expect(body!.messages.length).toBeLessThanOrEqual(2);
    expect(body!.max_tokens).toBe(100);
  });
});
