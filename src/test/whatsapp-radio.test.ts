// Finding something to listen to.
//
// Visionex has a radio service — stations, genres, countries, seeded globally —
// and WhatsApp had no way to reach it. It has no track catalogue, and a new
// external service here has to be keyless, so what this searches is what
// Visionex actually has: stations, named, with a link to play them.
//
// The line that matters most: `radio_stations.stream_url` is deliberately
// hidden. `radio-stream-token` exists so a browser never sees it, and listening
// is subscription-gated. Nothing here may route around that.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  MAX_STATIONS,
  MIN_TERM_CHARS,
  RADIO_URL,
  formatStations,
  noStationsNotice,
  parseRadioRequest,
  radioUnavailableNotice,
  readStations,
  stationName,
  stationTerms,
} from "../../supabase/functions/_shared/whatsappRadio.ts";
import { SUPPORTED_LANGUAGES } from "../../supabase/functions/_shared/whatsappLanguages.ts";

const row = (over: Record<string, unknown> = {}) => ({
  name: "Radio Beirut",
  name_ar: "راديو بيروت",
  language: "ar",
  country: "Lebanon",
  bitrate: "128",
  is_featured: false,
  ...over,
});

describe("hearing a request to listen", () => {
  it("recognises it in the languages people actually type", () => {
    for (const text of [
      "play me some music",
      "I want to listen to the radio",
      "شغلي موسيقى",
      "بدي أسمع إذاعة",
      "mets de la musique",
      "pon algo de música",
      "音楽をかけて",
      "음악 틀어줘",
      "放点音乐",
      "biraz müzik aç",
    ]) {
      expect(parseRadioRequest(text), text).not.toBeNull();
    }
  });

  it("ignores a message that is not about listening", () => {
    expect(parseRadioRequest("where is my order")).toBeNull();
    expect(parseRadioRequest("كم سعر العسل")).toBeNull();
    expect(parseRadioRequest("")).toBeNull();
    expect(parseRadioRequest(null)).toBeNull();
  });

  it("treats a long message as a weak guess", () => {
    // A paragraph mentioning music in passing is not a request for the radio,
    // and a weak guess falls through to the assistant rather than being
    // answered with a station list.
    const essay = `I was thinking about music ${"and other things ".repeat(12)}`;
    expect(parseRadioRequest(essay)?.confident).toBe(false);
    expect(parseRadioRequest("شغلي موسيقى")?.confident).toBe(true);
  });
});

describe("the words worth searching for", () => {
  it("drops the words that mean 'music' rather than naming any", () => {
    // "موسيقى" matches every station with the word in its description, so
    // searching for it is the same as searching for nothing — except slower
    // and with a worse result.
    expect(stationTerms("شغلي موسيقى هادية")).toEqual(["هادية"]);
    expect(stationTerms("play me some jazz music")).toEqual(["jazz"]);
  });

  it("leaves nothing to search when the request names no genre", () => {
    // Which is not a failure: an empty term list means the featured stations,
    // and that is the right answer to a bare "put some music on".
    expect(stationTerms("play some music")).toEqual([]);
    expect(stationTerms("بدي أسمع موسيقى")).toEqual([]);
  });

  it("ignores words too short to mean anything", () => {
    expect(MIN_TERM_CHARS).toBe(3);
    expect(stationTerms("play uk pop")).toEqual(["pop"]);
  });

  it("strips everything a filter could choke on", () => {
    // These terms are interpolated into a PostgREST `or` filter. A comma, a
    // parenthesis or a quote must not survive this far.
    const terms = stationTerms("music: jazz, (soul) 'blues' \"funk\"");
    for (const term of terms) {
      expect(term).toMatch(/^[\p{L}\p{N}]+$/u);
    }
    expect(terms.length).toBeLessThanOrEqual(3);
  });

  it("does not repeat a word", () => {
    expect(stationTerms("jazz jazz jazz radio")).toEqual(["jazz"]);
  });
});

describe("reading the stations", () => {
  it("keeps a station that has a name in either language", () => {
    expect(readStations([row(), row({ name: "", name_ar: "إذاعة" })])).toHaveLength(2);
  });

  it("drops one with no name at all", () => {
    expect(readStations([row({ name: "", name_ar: "" }), "no", null])).toEqual([]);
  });

  it("never carries a stream, whatever the row contains", () => {
    // The anon-safe view excludes `stream_url` by construction. This checks
    // that even a row carrying one cannot get it out of here.
    const [station] = readStations([row({ stream_url: "https://cdn.example/live.m3u8" })]);
    expect(Object.keys(station).sort())
      .toEqual(["bitrate", "country", "isFeatured", "language", "name", "nameAr"]);
    expect(JSON.stringify(station)).not.toContain("m3u8");
  });

  it("returns nothing for a shape it does not recognise", () => {
    expect(readStations(null)).toEqual([]);
    expect(readStations({})).toEqual([]);
  });
});

describe("the message a listener gets", () => {
  it("names the station, its country and its bitrate", () => {
    const message = formatStations({ language: "en", stations: readStations([row()]) });
    expect(message).toContain("Radio Beirut");
    expect(message).toContain("Lebanon");
    expect(message).toContain("128kbps");
  });

  it("uses the Arabic name for an Arabic reader", () => {
    const [station] = readStations([row()]);
    expect(stationName(station, "ar")).toBe("راديو بيروت");
    expect(stationName(station, "en")).toBe("Radio Beirut");
    // And falls back to the name the station calls itself.
    const [unnamed] = readStations([row({ name_ar: "" })]);
    expect(stationName(unnamed, "ar")).toBe("Radio Beirut");
  });

  it("sends the listener to Visionex to play, never to a stream", () => {
    // `radio-stream-token` exists so the stream URL is never handed out, and
    // listening is subscription-gated. A raw stream in a WhatsApp message would
    // route around both, for every station at once.
    const message = formatStations({ language: "en", stations: readStations([row()]) });
    expect(message).toContain(RADIO_URL);
    expect(message).not.toMatch(/\.m3u8|\.mp3|\.aac|icecast|shoutcast/i);
  });

  it("keeps the list short enough to hear", () => {
    const many = Array.from({ length: 12 }, (_, i) => row({ name: `Station ${i}`, name_ar: "" }));
    const message = formatStations({ language: "en", stations: readStations(many) });
    expect(MAX_STATIONS).toBe(5);
    expect(message.match(/^• /gm) ?? []).toHaveLength(MAX_STATIONS);
  });

  it("renders an empty result as the honest nothing", () => {
    expect(formatStations({ language: "en", stations: [] })).toBe(noStationsNotice("en"));
  });
});

describe("all twenty languages", () => {
  it("says both silences, differently, everywhere", () => {
    for (const language of SUPPORTED_LANGUAGES) {
      const none = noStationsNotice(language);
      const broken = radioUnavailableNotice(language);
      expect(none, language).not.toBe(broken);
      for (const text of [none, broken]) {
        expect(text, language).toContain(RADIO_URL);
        expect(text, language).not.toContain("{url}");
      }
    }
  });

  it("has its own words, with no English fallback", () => {
    const english = noStationsNotice("en");
    for (const language of SUPPORTED_LANGUAGES) {
      if (language === "en") continue;
      expect(noStationsNotice(language), language).not.toBe(english);
    }
  });

  it("gives the station list a heading in every language", () => {
    const headings = new Set<string>();
    for (const language of SUPPORTED_LANGUAGES) {
      const message = formatStations({ language, stations: readStations([row()]) });
      const heading = message.split("\n")[0];
      expect(heading.trim().length, language).toBeGreaterThan(0);
      headings.add(heading);
    }
    expect(headings.size).toBeGreaterThanOrEqual(SUPPORTED_LANGUAGES.length - 1);
  });
});

describe("the webhook's part", () => {
  const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");

  it("reads the anon-safe view, never the table", () => {
    // `radio_stations` carries `stream_url`. `radio_stations_public` does not,
    // and that is the whole reason to prefer it here.
    expect(webhook).toContain('from("radio_stations_public")');
    expect(webhook).not.toContain('from("radio_stations")');

    // No column position asks for it. Checked against the code rather than the
    // whole file, because the comment above the query names `stream_url` in
    // order to explain why it is not read — and that sentence is worth keeping.
    const code = webhook
      .split("\n")
      .filter((line) => {
        const trimmed = line.trim();
        return !trimmed.startsWith("//") && !trimmed.startsWith("*");
      })
      .join("\n");
    expect(code).not.toContain("stream_url");
  });

  it("asks about listening before it asks about shopping", () => {
    // "play me some jazz" is a listening request; the shopping parser would
    // otherwise take "jazz" for something to sell.
    expect(webhook.indexOf("parseRadioRequest(questionText)"))
      .toBeLessThan(webhook.indexOf("parseBazaarRequest(questionText)"));
  });

  it("answers only a confident request", () => {
    expect(webhook).toContain("radioRequest?.confident && !humanOwnsThis");
  });

  it("puts the featured stations first", () => {
    const branch = webhook.slice(webhook.indexOf('from("radio_stations_public")'));
    expect(branch.slice(0, 800)).toContain('order("is_featured", { ascending: false })');
  });

  it("logs an outcome and nothing a person typed", () => {
    const branch = webhook.slice(webhook.indexOf('from("radio_stations_public")'));
    const block = branch.slice(0, branch.indexOf("const bazaarRequest"));
    expect(block).toContain('log("radio", { outcome:');
    expect(block).not.toMatch(/log\("radio",[^)]*terms/);
    const logs = block.match(/console\.(log|error|warn)\([^;]*\)/g) ?? [];
    for (const line of logs) {
      expect(line, line).not.toMatch(/questionText|radioRequest\.terms|rows/);
    }
  });
});
