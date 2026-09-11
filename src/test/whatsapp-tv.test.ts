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
