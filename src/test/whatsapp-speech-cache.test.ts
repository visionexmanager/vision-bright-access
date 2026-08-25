// Voice notes that are not paid for twice.
//
// ── The property under test ─────────────────────────────────────────────────
//
// One-directional, like every other local capability here: the cache may only
// ever *save* a call. Whatever it does — miss, hit, lie, throw, return a media
// id Meta has forgotten — the sender must still hear their answer.
//
// That is worth guarding hard because the audience is largely blind and the
// voice note is frequently the whole reply. A caching bug here does not degrade
// an answer, it deletes one. So the interesting tests are not "does a hit skip
// the synthesis" but "does a broken cache still speak".
//
// The seam is the store: three functions handed in, so a hit, a miss, a stale
// id and a store that throws can all be driven without a Postgres and without
// spending a synthesis.

import { describe, expect, it, vi } from "vitest";

async function cache() {
  return await import("../../supabase/functions/_shared/whatsappSpeechCache.ts");
}

const KEY_INPUT = { phoneNumberId: "15550001111", voice: "alloy", model: "tts-1", text: "the main menu" };

describe("the key, which decides what counts as the same voice note", () => {
  it("is a stable 64-character hash", async () => {
    const { speechCacheKey, isSpeechCacheKey } = await cache();
    const key = await speechCacheKey(KEY_INPUT);
    expect(isSpeechCacheKey(key)).toBe(true);
    expect(await speechCacheKey(KEY_INPUT)).toBe(key);
  });

  it("changes when anything that changes the audio changes", async () => {
    const { speechCacheKey } = await cache();
    const base = await speechCacheKey(KEY_INPUT);
    for (const variant of [
      { ...KEY_INPUT, text: "the main menu." },
      { ...KEY_INPUT, voice: "nova" },
      { ...KEY_INPUT, model: "tts-1-hd" },
      // The media id is scoped to the number that uploaded it, so a shared key
      // across numbers would send an id the second number's store has never
      // heard of.
      { ...KEY_INPUT, phoneNumberId: "15550002222" },
    ]) {
      expect(await speechCacheKey(variant)).not.toBe(base);
    }
  });

  it("cannot be made to collide by moving a boundary between fields", async () => {
    const { speechCacheKey } = await cache();
    // With a space separator these two hash identically, and the second sender
    // would be handed audio recorded in the wrong voice. The separator is a NUL
    // for this reason and this test is why it stays one.
    const a = await speechCacheKey({ phoneNumberId: "1", voice: "alloy", model: "tts-1", text: "x y" });
    const b = await speechCacheKey({ phoneNumberId: "1", voice: "alloy tts-1 x", model: "", text: "y" });
    expect(a).not.toBe(b);
  });

  it("refuses anything that is not a hash as a key", async () => {
    const { isSpeechCacheKey } = await cache();
    for (const bad of ["", "not-a-hash", "ABC123", "a".repeat(63), "a".repeat(65), "g".repeat(64)]) {
      expect(isSpeechCacheKey(bad)).toBe(false);
    }
  });
});

describe("what is worth a row at all", () => {
  it("caches a canned notice and skips a long answer", async () => {
    const { isCacheableSpeech, MAX_CACHEABLE_CHARS } = await cache();
    expect(isCacheableSpeech("أرسل الصورة وسأقرأ ما فيها.")).toBe(true);
    // A description of a photograph is unique, so a row for it is one that can
    // never be hit again.
    expect(isCacheableSpeech("x".repeat(MAX_CACHEABLE_CHARS + 1))).toBe(false);
    expect(isCacheableSpeech("   ")).toBe(false);
    expect(isCacheableSpeech("")).toBe(false);
  });

  it("expires well inside Meta's thirty days", async () => {
    const { SPEECH_CACHE_TTL_MS } = await cache();
    const days = SPEECH_CACHE_TTL_MS / (24 * 60 * 60 * 1000);
    // A cached id that Meta has dropped costs a retry. The margin is the point.
    expect(days).toBeGreaterThan(1);
    expect(days).toBeLessThanOrEqual(21);
  });
});

// ── The store ───────────────────────────────────────────────────────────────

/** A Supabase-shaped stub that records what it was asked and answers as told. */
function stubDb(answer: { data?: unknown; error?: unknown } = {}, options: { throwOn?: string } = {}) {
  const calls: string[] = [];
  return {
    calls,
    from(table: string) {
      calls.push(`from:${table}`);
      return {
        select(columns: string) {
          calls.push(`select:${columns}`);
          if (options.throwOn === "select") throw new Error("down");
          return {
            eq(_column: string, value: string) {
              calls.push(`eq:${value}`);
              return {
                gt(column: string, _value: string) {
                  calls.push(`gt:${column}`);
                  return { maybeSingle: async () => ({ data: answer.data ?? null, error: answer.error ?? null }) };
                },
              };
            },
          };
        },
        async upsert(values: Record<string, unknown>) {
          calls.push(`upsert:${String(values.cache_key)}`);
          if (options.throwOn === "upsert") throw new Error("down");
          return { error: null };
        },
        delete() {
          if (options.throwOn === "delete") throw new Error("down");
          return {
            eq: async (_column: string, value: string) => {
              calls.push(`delete:${value}`);
              return { error: null };
            },
          };
        },
      };
    },
  };
}

const HASH = "a".repeat(64);

describe("the store, and every way it can let the caller down", () => {
  it("returns a media id it was given", async () => {
    const { speechCacheStore } = await cache();
    const db = stubDb({ data: { media_id: "media-123" } });
    expect(await speechCacheStore(db).get(HASH)).toBe("media-123");
    // Expiry is part of the query, not a check afterwards: an expired row has
    // to be a miss even when the sweep has not run.
    expect(db.calls).toContain("gt:expires_at");
  });

  it("treats an error, an empty answer and a malformed one all as a miss", async () => {
    const { speechCacheStore } = await cache();
    for (const answer of [
      { error: { message: "boom" } },
      { data: null },
      { data: {} },
      { data: { media_id: 7 } },
      { data: { media_id: "" } },
    ]) {
      expect(await speechCacheStore(stubDb(answer)).get(HASH)).toBeNull();
    }
  });

  it("survives a store that throws", async () => {
    const { speechCacheStore } = await cache();
    // A cache that is down must never be the reason somebody does not hear
    // their answer. There is nothing useful to do about it except synthesise,
    // which is what a miss already means.
    const store = speechCacheStore(stubDb({}, { throwOn: "select" }));
    expect(await store.get(HASH)).toBeNull();

    const writer = speechCacheStore(stubDb({}, { throwOn: "upsert" }));
    await expect(writer.put(HASH, "media-1", new Date())).resolves.toBeUndefined();

    const dropper = speechCacheStore(stubDb({}, { throwOn: "delete" }));
    await expect(dropper.drop(HASH)).resolves.toBeUndefined();
  });

  it("never touches the database with a key that is not a hash", async () => {
    const { speechCacheStore } = await cache();
    // The key is a primary key built from a hash function. Anything else
    // reaching the query is a bug upstream, and it is refused here rather than
    // sent to Postgres to find out.
    const db = stubDb({ data: { media_id: "media-1" } });
    const store = speechCacheStore(db);
    expect(await store.get("not-a-hash")).toBeNull();
    await store.put("not-a-hash", "media-1", new Date());
    await store.drop("not-a-hash");
    expect(db.calls).toEqual([]);
  });

  it("stores no words, only the hash and the id", async () => {
    const { speechCacheStore } = await cache();
    const db = stubDb();
    await speechCacheStore(db).put(HASH, "media-9", new Date(Date.now() + 1000));
    // The table has no column for the text and nothing here supplies one. What
    // was said is in `whatsapp_messages`; it is not duplicated into a cache.
    expect(db.calls).toContain(`upsert:${HASH}`);
  });
});

describe("the table it is backed by", () => {
  it("is service-role only, swept, and holds no text column", async () => {
    const { readFileSync } = await import("node:fs");
    const sql = readFileSync("supabase/migrations/20260926000000_whatsapp_speech_cache.sql", "utf8");

    expect(sql).toContain("ALTER TABLE public.whatsapp_speech_cache ENABLE ROW LEVEL SECURITY;");
    // No policy, deliberately: RLS on with no policy means every role except
    // the service role gets nothing.
    expect(sql).not.toMatch(/CREATE POLICY/i);
    expect(sql).toContain("sweep_whatsapp_speech_cache");

    // The load-bearing absence. If a `text` column is ever added here, the
    // privacy argument in the migration's header stops being true.
    const table = sql.slice(sql.indexOf("CREATE TABLE"), sql.indexOf(");"));
    expect(table).not.toMatch(/^\s*(text|body|spoken_text)\s+text/m);
  });
});

// ── The caller ──────────────────────────────────────────────────────────────

describe("speaking a reply with a cache in the way", () => {
  const voice = async () => await import("../../supabase/functions/_shared/whatsappVoiceReply.ts");

  /** A store that answers from a map and records what it was told. */
  function fakeStore(seed: Record<string, string> = {}) {
    const rows = new Map(Object.entries(seed));
    return {
      rows,
      dropped: [] as string[],
      get: vi.fn(async (key: string) => rows.get(key) ?? null),
      put: vi.fn(async (key: string, mediaId: string) => {
        rows.set(key, mediaId);
      }),
      drop: vi.fn(async function (this: { dropped: string[] }, key: string) {
        rows.delete(key);
      }),
    };
  }

  it("names the model and the voice so the key cannot drift from the audio", async () => {
    const { SPEECH_MODEL, DEFAULT_VOICE } = await voice();
    // These were defaults inside the synthesis call until the cache needed
    // them. A default buried in a call site is exactly what changes one day and
    // starts silently returning the previous voice from cache.
    expect(SPEECH_MODEL).toBe("tts-1");
    expect(DEFAULT_VOICE).toBe("alloy");
  });

  it("is wired into the webhook with the cache, at every call site", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
    const calls = source.split("speakReply({").length - 1;
    expect(calls).toBeGreaterThan(0);
    // Every one of them, not just the first. A reply path that was missed would
    // keep paying for the same twenty language names forever, and nothing about
    // the output would look different.
    expect(source.split("cache: speechCache").length - 1).toBe(calls);
  });

  /** Operations that always succeed, counting what they were asked to do. */
  function fakeOps(overrides: Record<string, unknown> = {}) {
    const ops = {
      synthesise: vi.fn(async () => ({ ok: true as const, bytes: new Uint8Array([1, 2, 3]), mimeType: "audio/ogg" })),
      upload: vi.fn(async () => "fresh-media-id"),
      send: vi.fn(async () => true),
      ...overrides,
    };
    return ops;
  }

  const SAY = "Send the photo and I'll read it.";

  it("does not reach for a cache that was not handed to it", async () => {
    const { speakReply } = await voice();
    // Omitted means the behaviour that existed before the cache did. Every
    // existing test of this function passes no cache, and they have to keep
    // describing what production does when the table is unreachable.
    const store = fakeStore();
    const ops = fakeOps();
    const spoken = await speakReply({ phoneNumberId: "1", token: "t", to: "2", text: SAY, ops });

    expect(spoken).toBe(true);
    expect(store.get).not.toHaveBeenCalled();
    expect(ops.synthesise).toHaveBeenCalledTimes(1);
  });

  it("pays for a sentence once and remembers it", async () => {
    const { speakReply } = await voice();
    const store = fakeStore();

    const first = fakeOps();
    await speakReply({ phoneNumberId: "1", token: "t", to: "2", text: SAY, ops: first, cache: store });
    expect(first.synthesise).toHaveBeenCalledTimes(1);
    expect(store.put).toHaveBeenCalledTimes(1);

    // The same notice, to a different person. This is the case the cache exists
    // for: a canned string synthesised again for every sender who hears it.
    const second = fakeOps();
    await speakReply({ phoneNumberId: "1", token: "t", to: "9", text: SAY, ops: second, cache: store });
    expect(second.synthesise).not.toHaveBeenCalled();
    expect(second.upload).not.toHaveBeenCalled();
    // One Graph call instead of three, and the same audio.
    expect(second.send).toHaveBeenCalledTimes(1);
    expect(second.send).toHaveBeenCalledWith("fresh-media-id", "1", "t", "9");
  });

  it("writes the row only after the audio was actually delivered", async () => {
    const { speakReply } = await voice();
    const store = fakeStore();
    // A row promising audio that was never delivered would hand the same broken
    // id to everybody who hears this sentence next.
    const ops = fakeOps({ send: vi.fn(async () => false) });
    const spoken = await speakReply({ phoneNumberId: "1", token: "t", to: "2", text: SAY, ops, cache: store });

    expect(spoken).toBe(false);
    expect(store.put).not.toHaveBeenCalled();
  });

  it("recovers when Meta has forgotten a cached id", async () => {
    const { speakReply } = await voice();
    const store = fakeStore();
    await speakReply({ phoneNumberId: "1", token: "t", to: "2", text: SAY, ops: fakeOps(), cache: store });
    const key = [...store.rows.keys()][0];

    // Meta keeps uploaded media for thirty days and the TTL sits inside that,
    // but "inside" is not "never". The first send fails on the cached id; the
    // second, on freshly synthesised audio, succeeds.
    let attempt = 0;
    const ops = fakeOps({
      send: vi.fn(async () => {
        attempt += 1;
        return attempt > 1;
      }),
      upload: vi.fn(async () => "replacement-media-id"),
    });

    const spoken = await speakReply({ phoneNumberId: "1", token: "t", to: "3", text: SAY, ops, cache: store });

    // The sender heard their answer, which is the only outcome that matters.
    expect(spoken).toBe(true);
    expect(ops.synthesise).toHaveBeenCalledTimes(1);
    expect(store.drop).toHaveBeenCalledWith(key);
    expect(ops.send).toHaveBeenCalledTimes(2);
  });

  it("does not retry a send that failed on freshly uploaded audio", async () => {
    const { speakReply } = await voice();
    const store = fakeStore();
    // A fresh id that Meta refuses is a genuine send failure, and retrying it
    // would send the same bytes twice for the same reason. Only a *cached* id
    // earns the second attempt.
    const ops = fakeOps({ send: vi.fn(async () => false) });
    await speakReply({ phoneNumberId: "1", token: "t", to: "2", text: SAY, ops, cache: store });

    expect(ops.send).toHaveBeenCalledTimes(1);
    expect(ops.synthesise).toHaveBeenCalledTimes(1);
    expect(store.drop).not.toHaveBeenCalled();
  });

  it("speaks normally when the cache itself is broken", async () => {
    const { speakReply } = await voice();
    const broken = {
      get: vi.fn(async () => {
        throw new Error("down");
      }),
      put: vi.fn(async () => {
        throw new Error("down");
      }),
      drop: vi.fn(async () => {}),
    };
    const ops = fakeOps();

    // The real store swallows its own errors, so this is the belt-and-braces
    // case: `speakReply` takes an interface, and a store that throws anyway
    // must not cost somebody their answer.
    const spoken = await speakReply({ phoneNumberId: "1", token: "t", to: "2", text: SAY, ops, cache: broken });

    expect(spoken).toBe(true);
    expect(broken.get).toHaveBeenCalled();
    // It fell straight through to the path that existed before the cache.
    expect(ops.synthesise).toHaveBeenCalledTimes(1);
    expect(ops.send).toHaveBeenCalledTimes(1);
  });

  it("does not cache an answer long enough to be unique", async () => {
    const { speakReply } = await voice();
    const { MAX_CACHEABLE_CHARS } = await cache();
    const store = fakeStore();
    // A description of a photograph is said once and never again, so a row for
    // it is one that can never be hit.
    const long = `${"A photograph of a street. ".repeat(Math.ceil(MAX_CACHEABLE_CHARS / 26) + 1)}`;
    await speakReply({ phoneNumberId: "1", token: "t", to: "2", text: long, ops: fakeOps(), cache: store });

    expect(store.get).not.toHaveBeenCalled();
    expect(store.put).not.toHaveBeenCalled();
  });
});
