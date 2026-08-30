// Asking for a song by name, over WhatsApp.
//
// Three things are being protected here, and only one of them is behaviour.
//
// The first is the licence line. Visionex may send a thirty-second preview
// from the publisher's own host, and a complete recording only when its licence
// says anyone may. Nothing in this file is allowed to blur that, so the tests
// assert both the audio that may be fetched and the sentence that goes with it.
//
// The second is the border with the radio. "Play me some music" is a station
// request and has been answered as one since #222; "play Enta Omry" is not.
// The parser is where those two part company, and it is asserted in both
// directions rather than assumed.
//
// The third is the rule that keeps this feature alive: no key, no account that
// can lapse, no provider that can switch it off by sending an invoice.

import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

const songs = await import("../../supabase/functions/_shared/whatsappSongs.ts");
const catalog = await import("../../supabase/functions/_shared/whatsappCatalog.ts");
const languages = await import("../../supabase/functions/_shared/whatsappLanguages.ts");
const interactive = await import("../../supabase/functions/_shared/whatsappInteractive.ts");

const source = readFileSync("supabase/functions/_shared/whatsappSongs.ts", "utf8");
const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
const LANGS = languages.SUPPORTED_LANGUAGES;

const SONG = {
  trackId: "922753943",
  title: "Enta Oumry",
  artist: "Umm Kulthum",
  album: "Enta Oumry (Remastered)",
  previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/mzaf_1.plus.aac.p.m4a",
  trackUrl: "https://music.apple.com/us/album/enta-oumry/922753882?i=922753943",
};

describe("naming a song", () => {
  it("hears a title behind the ways people ask for one", () => {
    expect(songs.parseSongRequest("أغنية انت عمري")?.query).toBe("انت عمري");
    expect(songs.parseSongRequest("بدي أغنية فيروز")?.query).toBe("فيروز");
    expect(songs.parseSongRequest("play Despacito")?.query).toBe("Despacito");
    expect(songs.parseSongRequest("songs by Fairuz")?.query).toBe("Fairuz");
    expect(songs.parseSongRequest("şarkı Sezen Aksu")?.query).toBe("Sezen Aksu");
    expect(songs.parseSongRequest("canción Bésame Mucho")?.query).toBe("Bésame Mucho");
  });

  it("leaves the genre to the radio, which already answers it", () => {
    // Empty rather than null: the words were about music, but no song was
    // named, and the webhook reads that as "not mine" unless Songs is open.
    expect(songs.parseSongRequest("play some music")?.query).toBe("");
    expect(songs.parseSongRequest("شغل لي موسيقى")?.query ?? "").toBe("");
    // The plural belongs to the station search and is not a song request.
    expect(songs.parseSongRequest("أغاني")).toBeNull();
  });

  it("does not answer a sentence that merely mentions a song", () => {
    for (const said of [
      "I heard this song at your shop and I want to complain about the service",
      "سمعت أغنية عندكم بالمحل وبدي اشتكي على الموظف اللي كان هناك",
      "",
      null,
    ]) {
      const parsed = songs.parseSongRequest(said);
      expect(parsed?.query || "", String(said)).toBe("");
    }
  });
});

describe("what may be fetched", () => {
  it("allows only the two hosts these catalogues serve audio from", () => {
    expect(songs.isAllowedAudioUrl(SONG.previewUrl)).toBe(true);
    expect(songs.isAllowedAudioUrl("https://upload.wikimedia.org/wikipedia/commons/1/2/x.ogg")).toBe(true);
    // Anything else, however plausible.
    expect(songs.isAllowedAudioUrl("https://example.com/track.mp3")).toBe(false);
    expect(songs.isAllowedAudioUrl("https://audio-ssl.itunes.apple.com.evil.test/x.m4a")).toBe(false);
    expect(songs.isAllowedAudioUrl("http://upload.wikimedia.org/x.ogg")).toBe(false);
    expect(songs.isAllowedAudioUrl("not a url")).toBe(false);
    expect(songs.isAllowedAudioUrl(null)).toBe(false);
  });

  it("refuses audio WhatsApp cannot play, and files too big to send", () => {
    const page = (mime: string, size: number) => ({
      query: {
        pages: {
          "1": {
            title: "File:Something.ogg",
            imageinfo: [{
              url: "https://upload.wikimedia.org/wikipedia/commons/1/2/x.ogg",
              descriptionurl: "https://commons.wikimedia.org/wiki/File:Something.ogg",
              mime,
              size,
            }],
          },
        },
      },
    });
    expect(songs.readFreeRecording(page("audio/ogg", 4_000_000))).not.toBeNull();
    // Commons labels its Ogg audio application/ogg, which is every free
    // recording it has. Rejecting that shipped a feature that could never
    // send one, and the type is corrected to what Meta expects on the way out.
    expect(songs.readFreeRecording(page("application/ogg", 2_317_258))?.mimeType).toBe("audio/ogg");
    // MIDI is audio and is not something a phone plays as a voice note.
    expect(songs.readFreeRecording(page("audio/midi", 10_000))).toBeNull();
    expect(songs.readFreeRecording(page("audio/mpeg", songs.SONG_MAX_BYTES + 1))).toBeNull();
    expect(songs.readFreeRecording({})).toBeNull();
  });

  it("checks the length twice, because a header is a claim", async () => {
    const body = new Uint8Array(1024);
    const respond = (headers: Record<string, string>, bytes = body) =>
      vi.fn(async () => new Response(bytes, { status: 200, headers })) as unknown as typeof fetch;

    const ok = await songs.fetchAudio(SONG.previewUrl, respond({
      "content-type": "audio/mp4",
      "content-length": String(body.byteLength),
    }));
    expect(ok?.bytes.byteLength).toBe(body.byteLength);
    expect(ok?.mimeType).toBe("audio/mp4");

    // Declared over the cap: refused before the body is read.
    const declared = await songs.fetchAudio(SONG.previewUrl, respond({
      "content-type": "audio/mp4",
      "content-length": String(songs.SONG_MAX_BYTES + 1),
    }));
    expect(declared).toBeNull();

    // Not audio at all, whatever the address suggested.
    const wrongKind = await songs.fetchAudio(SONG.previewUrl, respond({ "content-type": "text/html" }));
    expect(wrongKind).toBeNull();

    // A host nobody allowed is never even called.
    const spy = vi.fn();
    const called = await songs.fetchAudio("https://example.com/x.mp3", spy as unknown as typeof fetch);
    expect(called).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("what the sender is told", () => {
  const recording = {
    title: "Moonlight Sonata.ogg",
    audioUrl: "https://upload.wikimedia.org/wikipedia/commons/1/2/x.ogg",
    mimeType: "audio/ogg",
    bytes: 3_000_000,
    pageUrl: "https://commons.wikimedia.org/wiki/File:Moonlight_Sonata.ogg",
  };

  it("says a preview is a preview, and where the whole track is", () => {
    const message = songs.formatPreview({ song: SONG, language: "en" });
    expect(message).toContain(SONG.title);
    expect(message).toContain("Umm Kulthum");
    expect(message).toMatch(/thirty-second/i);
    expect(message).toContain(SONG.trackUrl);
  });

  it("says a free recording is another performance, and names its licence", () => {
    const message = songs.formatFreeRecording({ song: SONG, recording, language: "ar" });
    expect(message).toContain("ترخيص حر");
    expect(message).toContain(recording.pageUrl);
  });

  it("finishes both sentences in all twenty languages", () => {
    for (const language of LANGS) {
      for (const message of [
        songs.formatPreview({ song: SONG, language }),
        songs.formatFreeRecording({ song: SONG, recording, language }),
        songs.formatLinkOnly({ song: SONG, language }),
      ]) {
        // A translation that dropped {url} leaves the placeholder standing.
        expect(message, language).not.toMatch(/\{[a-z]+\}/i);
        expect(message.trim().length, language).toBeGreaterThan(0);
      }
    }
  });
});

describe("the menu row", () => {
  it("hangs beside the radio, and is not the radio", () => {
    const node = catalog.nodeById("services.songs");
    expect(node?.enabled).toBe(true);
    expect(node?.parent).toBe("services");
    expect(node?.phrase).toBeTruthy();
    // Tapping the row asks which song rather than searching for the word.
    expect(songs.parseSongRequest(catalog.localized(node!.phrase!, "ar"))?.query).toBe("");
    expect(songs.parseSongRequest(catalog.localized(node!.phrase!, "en"))?.query).toBe("");
  });

  it("is named in all twenty languages, within Meta's row limits", () => {
    const node = catalog.nodeById("services.songs")!;
    for (const language of LANGS) {
      const title = catalog.localized(node.title, language);
      const description = catalog.localized(node.description, language);
      expect(title, language).toBeTruthy();
      expect(title.length, `title.${language}`).toBeLessThanOrEqual(24);
      expect(description.length, `description.${language}`).toBeLessThanOrEqual(72);
    }
  });

  it("claims no word the radio already owns", () => {
    const radio = catalog.nodeById("services.radio")!;
    const mine = new Set(LANGS.flatMap((l) => catalog.aliasesOf(catalog.nodeById("services.songs")!, l)));
    for (const language of LANGS) {
      for (const word of catalog.aliasesOf(radio, language)) {
        expect(mine.has(word), `${language}: ${word}`).toBe(false);
      }
    }
  });

  it("builds a list whose rows carry the track id and a way back", () => {
    const message = interactive.songsMessage({ songs: [SONG], language: "en" });
    // A Tappable's action is a list *or* a pair of buttons, and only the list
    // has sections. Asserted rather than cast, so a message that quietly became
    // buttons fails here instead of skipping every check below.
    const action = message.interactive?.action;
    expect(action && "sections" in action).toBe(true);
    const rows = action && "sections" in action ? action.sections[0].rows : [];
    expect(rows[0].id).toBe(`song.${SONG.trackId}`);
    expect(rows[0].description).toContain("Umm Kulthum");
    expect(rows.some((row: { id: string }) => row.id.startsWith("back"))).toBe(true);
    expect(songs.parseSongSelection(rows[0].id)).toBe(SONG.trackId);
    // Only ids this built are followed.
    expect(songs.parseSongSelection("song.../../etc/passwd")).toBeNull();
    expect(songs.parseSongSelection("news.1")).toBeNull();
  });
});

describe("the service cannot be switched off by an invoice", () => {
  it("calls nothing that needs a key, and nothing that can hang", () => {
    expect(source).not.toMatch(/Deno\.env\.get\(/);
    expect(source).not.toMatch(/api[_-]?key|apikey|Authorization/i);
    // A hung catalogue must not hold a WhatsApp reply open.
    expect(source).toContain("AbortController");
    // Both services' policies expect a caller they can identify.
    expect(source).toMatch(/User-Agent/);
    expect(source).toContain("visionex.app");
  });
});

describe("the webhook's own wiring", () => {
  it("answers a named song before the radio answers a genre", () => {
    const songsAt = webhook.indexOf("const songQuery: string | null");
    const radioAt = webhook.indexOf("const radioRequest = aiFocused");
    expect(songsAt).toBeGreaterThan(0);
    expect(radioAt).toBeGreaterThan(songsAt);
  });

  it("respects the handover and the feature flag, on both doors", () => {
    expect(webhook).toContain('featureOn("services.songs")');
    expect(webhook).toContain('!humanOwnsThis && incoming.selection?.startsWith(SONG_ID_PREFIX)');
    expect(webhook).toContain("songQuery !== null && !humanOwnsThis");
  });

  it("falls back to the preview when a free recording cannot be sent", () => {
    const block = webhook.slice(webhook.indexOf("const deliverSong"), webhook.indexOf("// ── Abuse control"));
    // The free branch does not return unless the audio actually went out.
    expect(block).toContain(`log("songs", { outcome: "free", sent: false });`);
    expect(block.indexOf("song.previewUrl")).toBeGreaterThan(block.indexOf("findFreeRecording"));
    // And a preview that fails lands on the link rather than on silence.
    expect(block.indexOf(`outcome: "link"`)).toBeGreaterThan(block.indexOf(`outcome: "preview"`));
  });

  it("never writes what somebody listened to into a log line", () => {
    const block = webhook.slice(webhook.indexOf("const deliverSong"), webhook.indexOf("// ── Abuse control"));
    expect(block.length).toBeGreaterThan(0);
    for (const line of block.split("\n")) {
      if (!/console\.(log|error|warn)|^\s*log\(/.test(line)) continue;
      expect(line).not.toMatch(/song\.(title|artist|album|trackUrl|previewUrl)/);
      expect(line).not.toMatch(/free\.(title|audioUrl|pageUrl)/);
    }
  });
});
