// VisionTV, over WhatsApp.
//
// The site has had a television service since the TV migration — channels,
// categories, countries, a subscription and a stream token — and this channel
// had no way to reach any of it. What a chat window can honestly offer is the
// part that is hard on a television and easy here: *finding* the channel. So
// this searches what Visionex actually has, names the channels, and links to
// the page that plays each one.
//
// The line that matters most: `tv_channels.stream_url` is deliberately hidden.
// The table's own policy says "Users see channel metadata but NEVER
// stream_url", the read grant is to `authenticated` alone, and watching is
// subscription-gated. The webhook holds a service-role client, so row-level
// security is not what protects this — the anon-safe *view* is, and these tests
// are what notice if the query is ever pointed back at the table.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  MAX_CHANNELS,
  MIN_TERM_CHARS,
  TV_URL,
  carriesStream,
  channelName,
  channelTerms,
  formatChannels,
  noChannelsNotice,
  parseTvRequest,
  readChannels,
  tvUnavailableNotice,
  tvWatchUrl,
  TV_CATEGORY_ID_PREFIX,
  TV_CHANNEL_ID_PREFIX,
  TV_PAGE_SIZE,
  categoryLabel,
  channelPage,
  formatChannel,
  parseTvCategorySelection,
  parseTvChannelSelection,
  readCategories,
  tvCategoryRowId,
  tvChannelRowId,
} from "../../supabase/functions/_shared/whatsappTv.ts";

const languages = await import("../../supabase/functions/_shared/whatsappLanguages.ts");
const catalog = await import("../../supabase/functions/_shared/whatsappCatalog.ts");
const strings = await import("../../supabase/functions/_shared/whatsappStrings.ts");

const LANGS = languages.SUPPORTED_LANGUAGES;
const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");

const row = (over: Record<string, unknown> = {}) => ({
  id: "11111111-2222-3333-4444-555555555555",
  name: "Al Mamlaka",
  name_ar: "المملكة",
  description: "Jordanian public news",
  description_ar: "قناة إخبارية أردنية",
  language: "ar",
  country: "Jordan",
  quality: "HD",
  is_featured: true,
  ...over,
});

// ── Asking to watch ──────────────────────────────────────────────────────────

describe("hearing a request for television", () => {
  it("hears it in the words people use, in both parser languages", () => {
    for (
      const asked of [
        "tv",
        "I want to watch tv",
        "show me the channels",
        "live stream",
        "تلفزيون",
        "بدي أشوف تلفزيون",
        "شو القنوات عندكم",
        "بث مباشر",
      ]
    ) {
      expect(parseTvRequest(asked), asked).not.toBeNull();
    }
  });

  it("does not hear it in a message that is about something else", () => {
    for (const other of ["", "   ", "what is the weather", "شو أخبار الطقس", "my order is late"]) {
      expect(parseTvRequest(other), other).toBeNull();
    }
  });

  it("does not claim the radio's words", () => {
    // The two rows sit in the same menu and must not answer each other's
    // requests: the radio's own intent list does not claim "live" or «بث»,
    // and this must not claim music.
    for (const musical of ["play me some music", "بدي أسمع موسيقى", "أغاني هادية"]) {
      expect(parseTvRequest(musical), musical).toBeNull();
    }
  });

  it("hands a rambling message back rather than answering it with channels", () => {
    const essay = `I saw a television programme once ${"about many things ".repeat(12)}`;
    expect(essay.length).toBeGreaterThan(120);
    expect(parseTvRequest(essay)?.confident).toBe(false);
  });

  it("searches on what is left once the word for television is removed", () => {
    // «بدي أشوف قنوات رياضة» means the sports channels, not every channel with
    // the word "channel" in its description.
    expect(channelTerms("بدي أشوف قنوات رياضة")).toEqual(["رياضة"]);
    expect(channelTerms("show me news channels")).toEqual(["news"]);
    // Nothing left is not an error: it is a request for the featured channels.
    expect(channelTerms("tv")).toEqual([]);
    expect(channelTerms("بدي تلفزيون")).toEqual([]);
  });

  it("keeps a term safe to interpolate into a filter", () => {
    // The same guarantee `stationTerms` gives, asserted here rather than
    // assumed from the family resemblance: the webhook builds a PostgREST `or`
    // out of these, and a comma or a parenthesis would change its meaning.
    const terms = channelTerms('news,(bad) "quoted" %wild% ilike.*');
    for (const term of terms) {
      expect(term, term).toMatch(/^[\p{L}\p{N}]+$/u);
    }
  });

  it("ignores a word too short to identify anything", () => {
    expect(MIN_TERM_CHARS).toBeGreaterThan(2);
    expect(channelTerms("tv on bt")).toEqual([]);
  });
});

// ── Reading the rows ─────────────────────────────────────────────────────────

describe("reading what the view returns", () => {
  it("reads a channel", () => {
    const [channel] = readChannels([row()]);
    expect(channel.id).toBe("11111111-2222-3333-4444-555555555555");
    expect(channel.name).toBe("Al Mamlaka");
    expect(channel.nameAr).toBe("المملكة");
    expect(channel.country).toBe("Jordan");
    expect(channel.quality).toBe("HD");
    expect(channel.isFeatured).toBe(true);
  });

  it("never carries a stream, whatever the row holds", () => {
    // The view excludes `stream_url` by construction. This checks the shape
    // this module produces, so a query pointed back at the table cannot leak
    // one through the formatter either.
    const [channel] = readChannels([row({ stream_url: "https://cdn.example/live.m3u8" })]);
    expect(JSON.stringify(channel)).not.toContain("m3u8");
    expect(JSON.stringify(channel)).not.toContain("stream");
    const message = formatChannels({ language: "en", channels: [channel] });
    expect(message).not.toContain("m3u8");
    expect(message).not.toContain("cdn.example");
  });

  it("notices a row that came from the table rather than the view", () => {
    expect(carriesStream(row({ stream_url: "x" }))).toBe(true);
    expect(carriesStream(row({ hls_stream: "x" }))).toBe(true);
    expect(carriesStream(row({ rtmp_url: "x" }))).toBe(true);
    expect(carriesStream(row())).toBe(false);
    expect(carriesStream(null)).toBe(false);
    expect(carriesStream("not a row")).toBe(false);
  });

  it("drops a row with nothing to name it, rather than showing a blank line", () => {
    expect(readChannels([row({ name: "", name_ar: "" })])).toEqual([]);
    expect(readChannels([row({ id: "" })])).toEqual([]);
  });

  it("survives a payload that is not what it expected", () => {
    // Somebody asked to watch television; a `TypeError` is not television.
    expect(readChannels(null)).toEqual([]);
    expect(readChannels("nonsense")).toEqual([]);
    expect(readChannels([null, 7, "x", row()])).toHaveLength(1);
  });

  it("falls back to the Arabic name when that is the only one", () => {
    const [channel] = readChannels([row({ name: "" })]);
    expect(channel.name).toBe("المملكة");
  });
});

// ── What a sender receives ───────────────────────────────────────────────────

describe("the message", () => {
  it("names each channel and gives it its own link", () => {
    // One link per channel rather than one for all five. A sender who cannot
    // see the screen hears a name and then the address for it; five names and
    // a single address at the end is a puzzle.
    const channels = readChannels([row(), row({ id: "aaaa", name: "Roya", name_ar: "رؤيا" })]);
    const message = formatChannels({ language: "en", channels });
    expect(message).toContain("Al Mamlaka");
    expect(message).toContain(tvWatchUrl("11111111-2222-3333-4444-555555555555"));
    expect(message).toContain("Roya");
    expect(message).toContain(tvWatchUrl("aaaa"));
  });

  it("answers in the reader's language where the channel has one", () => {
    const channels = readChannels([row()]);
    expect(formatChannels({ language: "ar", channels })).toContain("المملكة");
    expect(formatChannels({ language: "en", channels })).toContain("Al Mamlaka");
    expect(channelName(channels[0], "tr")).toBe("Al Mamlaka");
  });

  it("puts country and quality where somebody chooses between two channels", () => {
    const message = formatChannels({ language: "en", channels: readChannels([row()]) });
    expect(message).toContain("Jordan");
    expect(message).toContain("HD");
  });

  it("carries no more than one message can hold", () => {
    const many = Array.from({ length: 20 }, (_, i) => row({ id: `id-${i}`, name: `Channel ${i}` }));
    const message = formatChannels({ language: "en", channels: readChannels(many) });
    expect(message).toContain("Channel 0");
    expect(message).not.toContain(`Channel ${MAX_CHANNELS}`);
  });

  it("says nothing matched rather than sending an empty list", () => {
    expect(formatChannels({ language: "en", channels: [] })).toBe(noChannelsNotice("en"));
    expect(noChannelsNotice("en")).toContain(TV_URL);
  });

  it("tells a broken lookup apart from an empty one", () => {
    expect(tvUnavailableNotice("en")).not.toBe(noChannelsNotice("en"));
    expect(tvUnavailableNotice("en")).toContain(TV_URL);
  });

  it("builds a watch link the site actually registers", () => {
    expect(tvWatchUrl("abc")).toBe("https://visionex.app/services/live-tv/watch/abc");
  });

  it("leaves no placeholder standing, in any of the twenty languages", () => {
    const channels = readChannels([row()]);
    for (const language of LANGS) {
      for (
        const message of [
          formatChannels({ language, channels }),
          noChannelsNotice(language),
          tvUnavailableNotice(language),
        ]
      ) {
        expect(message, language).not.toMatch(/\{[a-z]+\}/i);
        expect(message.trim().length, language).toBeGreaterThan(0);
      }
    }
  });

  it("is written in all twenty, not in two", () => {
    for (const key of ["tvHeading", "tvHint", "tvNone", "tvUnavailable"] as const) {
      for (const language of LANGS) {
        expect(strings.say(key, language).trim().length, `${key}/${language}`).toBeGreaterThan(0);
      }
    }
  });
});

// ── The boundary this feature sits on ────────────────────────────────────────

describe("the stream is not ours to give", () => {
  it("reads the anon-safe view, never the table", () => {
    // `tv_channels` carries `stream_url`. `tv_channels_public` does not, by
    // construction — and the webhook runs as service role, so the view is the
    // only thing standing between this feature and a leak.
    expect(webhook).toContain('from("tv_channels_public")');
    const branch = webhook.slice(webhook.indexOf('from("tv_channels_public")'));
    expect(branch.slice(0, 600)).not.toContain('from("tv_channels")');
  });

  it("never names a stream column in what it selects", () => {
    const branch = webhook.slice(webhook.indexOf('from("tv_channels_public")'), webhook.indexOf('from("tv_channels_public")') + 600);
    expect(branch).not.toMatch(/stream_url|m3u8|rtmp/i);
  });

  it("asks for nothing but metadata", () => {
    const module = readFileSync("supabase/functions/_shared/whatsappTv.ts", "utf8");
    // The module may *name* the column in prose explaining why it is absent —
    // the header does exactly that — but it may never read one off a row.
    expect(module).not.toMatch(/record\.\w*stream/i);
    expect(module).not.toMatch(/record\[["'][^"']*stream/i);
  });
});

describe("the row on the menu", () => {
  it("is offered, under the menu that now says it holds television", () => {
    const node = catalog.nodeById("listen.tv");
    expect(node).toBeTruthy();
    expect(node!.enabled).toBe(true);
    expect(catalog.offeredChildrenOf("listen").map((child) => child.id)).toContain("listen.tv");
    for (const language of ["en", "ar"] as const) {
      const parent = catalog.localized(catalog.nodeById("listen")!.title, language);
      expect(parent, language).not.toBe("Listen");
    }
  });

  it("names itself in every language, inside a row's limits", () => {
    const node = catalog.nodeById("listen.tv")!;
    for (const language of LANGS) {
      const title = catalog.localized(node.title, language);
      const description = catalog.localized(node.description, language);
      expect([...title].length, language).toBeLessThanOrEqual(catalog.LIST_LIMITS.rowTitle);
      expect([...description].length, language).toBeLessThanOrEqual(catalog.LIST_LIMITS.rowDescription);
      expect(title.trim().length, language).toBeGreaterThan(0);
    }
  });

  it("answers to its own phrase, which is what the menu row sends", () => {
    const node = catalog.nodeById("listen.tv")!;
    for (const language of ["en", "ar"] as const) {
      expect(parseTvRequest(catalog.localized(node.phrase!, language))?.confident, language).toBe(true);
    }
  });
});

// ── Browsing ────────────────────────────────────────────────────────────────
//
// Reported: the menu led to *Watch TV*, it was tapped, and what came back was
// five channels from anywhere on earth. Somebody who taps a row has not thought
// of a channel name yet — that is why they tapped instead of typing. A category
// first, then its channels, then the one link.

const categoryRow = (over: Record<string, unknown> = {}) => ({
  id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  slug: "news",
  name: "News",
  name_ar: "أخبار",
  ...over,
});

describe("the categories a sender picks from", () => {
  it("reads the rows, and drops one it cannot name or address", () => {
    const categories = readCategories([
      categoryRow(),
      categoryRow({ id: "", slug: "sport" }),
      categoryRow({ slug: "" }),
      categoryRow({ name: "", name_ar: "" }),
      "not an object",
      null,
    ]);
    expect(categories).toHaveLength(1);
    expect(categories[0].slug).toBe("news");
    expect(readCategories(null)).toEqual([]);
  });

  it("falls back to the English name where there is no Arabic one", () => {
    const [withArabic] = readCategories([categoryRow()]);
    expect(categoryLabel(withArabic, "ar")).toBe("أخبار");
    expect(categoryLabel(withArabic, "en")).toBe("News");
    // Eighteen other languages read the English name: `tv_categories` holds
    // two columns and inventing the rest here would be a second source.
    expect(categoryLabel(withArabic, "fr")).toBe("News");

    const [english] = readCategories([categoryRow({ name_ar: "" })]);
    expect(categoryLabel(english, "ar")).toBe("News");
  });
});

describe("a tapped row says which one, and where in it", () => {
  it("round-trips a category and its page", () => {
    expect(parseTvCategorySelection(tvCategoryRowId("news"))).toEqual({ category: "news", page: 0 });
    expect(parseTvCategorySelection(tvCategoryRowId("news", 3))).toEqual({ category: "news", page: 3 });
    // A slug with a dot in it still resolves: the page is read from the last one.
    expect(parseTvCategorySelection(tvCategoryRowId("kids.tv", 2)))
      .toEqual({ category: "kids.tv", page: 2 });
  });

  it("round-trips a channel", () => {
    const id = "11111111-2222-3333-4444-555555555555";
    expect(parseTvChannelSelection(tvChannelRowId(id))).toBe(id);
  });

  it("refuses anything that is not one of its own rows", () => {
    for (const id of [null, undefined, "", "listen.tv", "svc.hub.health.0", "news.abc"]) {
      expect(parseTvCategorySelection(id), String(id)).toBeNull();
      expect(parseTvChannelSelection(id), String(id)).toBeNull();
    }
    // Its own prefix, but carrying nothing usable.
    expect(parseTvCategorySelection(`${TV_CATEGORY_ID_PREFIX}news`)).toBeNull();
    expect(parseTvCategorySelection(`${TV_CATEGORY_ID_PREFIX}news.-1`)).toBeNull();
    expect(parseTvCategorySelection(`${TV_CATEGORY_ID_PREFIX}.0`)).toBeNull();
    expect(parseTvChannelSelection(TV_CHANNEL_ID_PREFIX)).toBeNull();
  });

  it("cannot be mistaken for another feature's row", () => {
    expect(TV_CATEGORY_ID_PREFIX).not.toBe(TV_CHANNEL_ID_PREFIX);
    expect(tvChannelRowId("x").startsWith(TV_CATEGORY_ID_PREFIX)).toBe(false);
    expect(tvCategoryRowId("x").startsWith(TV_CHANNEL_ID_PREFIX)).toBe(false);
  });
});

describe("one page of channels", () => {
  const many = (count: number) =>
    readChannels(Array.from({ length: count }, (_, i) => row({ id: `id-${i}`, name: `Channel ${i}` })));

  it("leaves room for the more row and the two controls", () => {
    // Meta allows ten rows in a list, in total. Seven content rows, a "more"
    // row, Back and Main menu is exactly ten.
    expect(TV_PAGE_SIZE).toBe(7);
  });

  it("carries a more row only while there is more", () => {
    expect(channelPage(many(7), 0).hasMore).toBe(false);
    expect(channelPage(many(8), 0).hasMore).toBe(true);
    expect(channelPage(many(8), 1).hasMore).toBe(false);
    expect(channelPage(many(8), 1).channels).toHaveLength(1);
  });

  it("clamps a page nobody can be on rather than returning nothing", () => {
    // A row from an older list can name a page that no longer exists.
    expect(channelPage(many(3), 9).page).toBe(0);
    expect(channelPage(many(3), -4).page).toBe(0);
    expect(channelPage(many(3), Number.NaN).page).toBe(0);
    expect(channelPage([], 2)).toEqual({ page: 0, channels: [], hasMore: false });
  });

  it("does not reorder what the query already ordered", () => {
    const page = channelPage(many(3), 0);
    expect(page.channels.map((channel) => channel.name)).toEqual(["Channel 0", "Channel 1", "Channel 2"]);
  });
});

describe("the channel a sender chose", () => {
  const [channel] = readChannels([row()]);

  it("gives the watch page, and never a stream", () => {
    const card = formatChannel({ channel, language: "en" });
    expect(card).toContain(tvWatchUrl(channel.id));
    expect(card).not.toMatch(/m3u8|rtmp|stream_url/i);
  });

  it("names it, and says what it is, in the reader's language", () => {
    expect(formatChannel({ channel, language: "ar" })).toContain("المملكة");
    expect(formatChannel({ channel, language: "ar" })).toContain("قناة إخبارية أردنية");
    expect(formatChannel({ channel, language: "en" })).toContain("Al Mamlaka");
    expect(formatChannel({ channel, language: "en" })).toContain("Jordanian public news");
  });

  it("says nothing it does not have", () => {
    const [bare] = readChannels([row({ description: "", description_ar: "", country: "", quality: "" })]);
    const card = formatChannel({ channel: bare, language: "en" });
    expect(card).not.toContain("undefined");
    expect(card).not.toContain("null");
    expect(card.split("\n").filter((line) => line.trim() === "—")).toHaveLength(0);
  });
});

describe("the webhook browses before it searches", () => {
  it("answers a request that named nothing with the categories", () => {
    expect(webhook).toContain("if (tvRequest.terms.length === 0) {");
    expect(webhook).toContain("await showTvCategories();");
  });

  it("reads the categories from their own table, in order", () => {
    expect(webhook).toContain('.from("tv_categories")');
    expect(webhook).toContain('.select("id, slug, name, name_ar")');
  });

  it("still reads channels from the anon-safe view, never the table", () => {
    // The rule this whole file exists to hold, now on three queries.
    expect(webhook).not.toContain('.from("tv_channels")');
    const queries = webhook.match(/\.from\("tv_channels_public"\)/g) ?? [];
    expect(queries.length).toBeGreaterThanOrEqual(3);
  });

  it("guards every one of those queries with the stream filter", () => {
    const guards = webhook.match(/filter\(\(row\) => !carriesStream\(row\)\)/g) ?? [];
    expect(guards.length).toBeGreaterThanOrEqual(3);
  });

  it("answers a row from an older list rather than ignoring it", () => {
    expect(webhook).toContain('await reply(say("tvStale", answerLanguage), "reply");');
  });

  it("honours a human takeover on both new rows", () => {
    expect(webhook).toContain("if (!humanOwnsThis && incoming.selection?.startsWith(TV_CATEGORY_ID_PREFIX))");
    expect(webhook).toContain("if (!humanOwnsThis && incoming.selection?.startsWith(TV_CHANNEL_ID_PREFIX))");
  });

  it("does not log which page of a menu somebody was on", () => {
    const block = webhook.slice(
      webhook.indexOf("TV_CATEGORY_ID_PREFIX))"),
      webhook.indexOf("TV_CHANNEL_ID_PREFIX))"),
    );
    expect(block).not.toMatch(/log\("tv", \{[^}]*page/);
  });
});

describe("the browsing words exist everywhere", () => {
  it("says all four, in every language", () => {
    for (const language of LANGS) {
      for (const key of ["tvCategories", "tvBrowseButton", "tvMore", "tvStale"] as const) {
        const sentence = strings.say(key, language);
        expect(sentence.trim().length, `${key}/${language}`).toBeGreaterThan(0);
        expect(sentence, `${key}/${language}`).not.toMatch(/\{[a-z]+\}/i);
      }
    }
  });

  it("keeps a button and a section title inside Meta's limits", () => {
    for (const language of LANGS) {
      const button = strings.say("tvBrowseButton", language);
      expect([...button].length, language).toBeLessThanOrEqual(catalog.LIST_LIMITS.button);
      const more = strings.say("tvMore", language);
      expect([...more].length, language).toBeLessThanOrEqual(catalog.LIST_LIMITS.rowTitle);
    }
  });

  it("keeps the category heading's placeholder in every language", () => {
    for (const language of LANGS) {
      expect(strings.say("tvInCategory", language), language).toContain("{name}");
    }
  });
});
