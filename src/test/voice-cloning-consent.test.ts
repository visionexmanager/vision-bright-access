// Cloning a real person's voice, and the rules that make that safe to operate.
//
// Three questions have to have an answer at all times: did they agree, is that
// agreement still standing, and when the answer became no, was the copy
// actually destroyed. Everything below is one of those three.
//
// The SQL half — RLS, the generated `voice_state` column, the three RPCs and
// the retention sweep — was executed against PGlite before this landed, the way
// `whatsapp-account.test.ts` describes. What is asserted here is that the
// migration still *says* what was executed, and that the TypeScript that
// decides before the database gets a say agrees with it.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  CONSENT_STATEMENT_V1,
  SAMPLE_RETENTION_DAYS,
  deletionOutcome,
  isUsableVoice,
  mayStartCloning,
  safeProviderReason,
  sampleRetentionFrom,
  voiceStateOf,
} from "../../supabase/functions/_shared/voice/consent.ts";
import {
  MAX_VOICE_SLOTS,
  noVoicesNotice,
  readResolvedVoice,
  readVoiceOptions,
  readVoiceRowId,
  voiceChoiceRows,
  voiceGoneNotice,
  voiceNeedsAccountNotice,
  voiceRowId,
  voiceSelectedNotice,
} from "../../supabase/functions/_shared/whatsappVoiceChoice.ts";
import { SUPPORTED_LANGUAGES } from "../../supabase/functions/_shared/whatsappLanguages.ts";

const ready = {
  status: "completed",
  consentStatus: "granted",
  lifecycleState: "active",
  providerVoiceId: "el_abc123",
};

describe("consent decides whether a voice exists at all", () => {
  it("refuses cloning when nobody has consented", () => {
    expect(mayStartCloning({ consentStatus: "pending", lifecycleState: "active", sampleCount: 3 }))
      .toEqual({ gate: "refused", refusal: "consent_missing" });
  });

  it("allows cloning once consent is recorded", () => {
    expect(mayStartCloning({ consentStatus: "granted", lifecycleState: "active", sampleCount: 3 }))
      .toEqual({ gate: "allowed" });
  });

  it("refuses cloning after consent is withdrawn", () => {
    expect(mayStartCloning({ consentStatus: "revoked", lifecycleState: "active", sampleCount: 3 }))
      .toEqual({ gate: "refused", refusal: "consent_revoked" });
  });

  it("refuses a voice that is being deleted, whatever its consent says", () => {
    expect(mayStartCloning({ consentStatus: "granted", lifecycleState: "deleting", sampleCount: 3 }))
      .toEqual({ gate: "refused", refusal: "already_deleted" });
  });

  it("refuses with no recordings, so an empty clone is never created", () => {
    expect(mayStartCloning({ consentStatus: "granted", lifecycleState: "active", sampleCount: 0 }))
      .toEqual({ gate: "refused", refusal: "no_samples" });
  });

  it("keeps the wording that was agreed to, rather than a boolean", () => {
    // A record that cannot answer "consented to what?" is not a consent record,
    // and the wording will change — so it is versioned in the text itself.
    expect(CONSENT_STATEMENT_V1).toMatch(/^v1: /);
    expect(CONSENT_STATEMENT_V1).toMatch(/withdraw/i);
    expect(CONSENT_STATEMENT_V1).toMatch(/own voice|permission/i);
  });
});

describe("the lifecycle, in one vocabulary", () => {
  it("is ready only when trained, consented and not being deleted", () => {
    expect(voiceStateOf(ready)).toBe("ready");
    expect(isUsableVoice(ready)).toBe(true);
  });

  it("walks every transition the system can be in", () => {
    expect(voiceStateOf({ ...ready, consentStatus: "pending" })).toBe("pending_consent");
    expect(voiceStateOf({ ...ready, consentStatus: "revoked" })).toBe("revoked");
    expect(voiceStateOf({ ...ready, lifecycleState: "deleting" })).toBe("deleting");
    expect(voiceStateOf({ ...ready, lifecycleState: "deleted" })).toBe("deleted");
    expect(voiceStateOf({ ...ready, lifecycleState: "error" })).toBe("error");
    expect(voiceStateOf({ ...ready, status: "failed" })).toBe("error");
    expect(voiceStateOf({ ...ready, status: "training" })).toBe("pending_consent");
  });

  it("ranks deletion above revocation above consent", () => {
    // A voice can be revoked *and* mid-deletion. Whichever makes the others
    // moot is the one reported, or two parts of the system disagree.
    expect(voiceStateOf({ ...ready, consentStatus: "revoked", lifecycleState: "deleting" }))
      .toBe("deleting");
    expect(voiceStateOf({ ...ready, consentStatus: "revoked", lifecycleState: "deleted" }))
      .toBe("deleted");
  });

  it("is not ready without a provider voice behind it", () => {
    // A `provider_voice_id` of null with status 'completed' would be a voice
    // that cannot speak, offered as though it could.
    expect(isUsableVoice({ ...ready, providerVoiceId: null })).toBe(false);
  });
});

describe("deletion, and never claiming one that did not happen", () => {
  it("is complete when the provider deleted and the recordings went", () => {
    expect(deletionOutcome({ provider: { outcome: "deleted" }, samplesRemoved: true }))
      .toEqual({ deletion: "complete" });
  });

  it("treats a voice the provider never had as gone, because it is", () => {
    expect(deletionOutcome({ provider: { outcome: "absent" }, samplesRemoved: true }))
      .toEqual({ deletion: "complete" });
  });

  it("refuses to report success when the provider call failed", () => {
    // The whole point. A copy of somebody's voice surviving a deletion they
    // asked for must never be reported as deleted.
    const outcome = deletionOutcome({
      provider: { outcome: "failed", reason: "HTTP 500" },
      samplesRemoved: true,
    });
    expect(outcome.deletion).toBe("incomplete");
    if (outcome.deletion !== "incomplete") return;
    expect(outcome.lifecycleState).toBe("error");
    expect(outcome.reason).toContain("provider");
  });

  it("refuses to report success when the recordings survived", () => {
    const outcome = deletionOutcome({ provider: { outcome: "deleted" }, samplesRemoved: false });
    expect(outcome.deletion).toBe("incomplete");
    if (outcome.deletion !== "incomplete") return;
    expect(outcome.reason).toContain("samples");
  });

  it("gives the recordings a retention clock rather than keeping them forever", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    expect(SAMPLE_RETENTION_DAYS).toBe(90);
    expect(sampleRetentionFrom(now).toISOString()).toBe("2026-04-01T00:00:00.000Z");
  });
});

describe("what a stored failure is allowed to contain", () => {
  it("strips anything that looks like a credential", () => {
    expect(safeProviderReason("xi-api-key: sk_live_9f8a7b6c5d4e3f2a1b"))
      .not.toContain("sk_live_9f8a7b6c5d4e3f2a1b");
    expect(safeProviderReason("Authorization: Bearer eyJhbGciOi")).toContain("[redacted]");
    expect(safeProviderReason(new Error("failed calling https://api.elevenlabs.io/v1/voices/x?key=abc")))
      .not.toContain("key=abc");
  });

  it("keeps enough for an operator to act on", () => {
    expect(safeProviderReason("HTTP 500")).toBe("HTTP 500");
    expect(safeProviderReason(new Error("network unreachable"))).toBe("network unreachable");
  });

  it("cannot grow without bound, whatever a provider returns", () => {
    expect(safeProviderReason("x".repeat(5000)).length).toBeLessThanOrEqual(300);
  });
});

// ── The WhatsApp side ───────────────────────────────────────────────────────

const option = (slot: number, name: string, selected = false) =>
  ({ slot, name, language: "en", selected });

describe("the voice list a sender is offered", () => {
  it("always offers the default first, so there is a way back", () => {
    const rows = voiceChoiceRows([option(1, "Nour")], "en");
    expect(rows[0].id).toBe(voiceRowId(0));
    expect(rows).toHaveLength(2);
  });

  it("marks the current choice in words a screen reader reads", () => {
    const chosen = voiceChoiceRows([option(1, "Nour", true)], "en");
    expect(chosen[1].title.startsWith("✓")).toBe(true);
    expect(chosen[0].title.startsWith("✓")).toBe(false);

    const none = voiceChoiceRows([option(1, "Nour")], "en");
    expect(none[0].title.startsWith("✓")).toBe(true);
  });

  it("never puts an id of any kind into a row", () => {
    // A row id comes straight back to us in a webhook payload, which is to say:
    // it is printed in a chat log. Only a slot number goes in one.
    const rows = voiceChoiceRows([option(1, "Nour"), option(2, "Sami")], "en");
    for (const row of rows) {
      expect(row.id).toMatch(/^voice_pick_\d{1,2}$/);
      expect(row.id).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/);
      expect(row.id).not.toContain("el_");
    }
  });

  it("cannot offer more voices than a Meta list has room for", () => {
    const many = Array.from({ length: 20 }, (_, i) => option(i + 1, `Voice ${i + 1}`));
    // Eight, plus the default. Ten rows is Meta's ceiling across every section.
    expect(voiceChoiceRows(many, "en")).toHaveLength(MAX_VOICE_SLOTS + 1);
  });
});

describe("reading what the database returned", () => {
  it("keeps well-formed rows and drops anything else", () => {
    const parsed = readVoiceOptions([
      { slot: 1, name: "Nour", language: "ar", selected: true },
      { slot: 2, name: "  ", language: "en" },          // blank name
      { slot: 0, name: "Impossible" },                   // slot 0 is the default
      { slot: 99, name: "Out of range" },
      "not an object",
      null,
    ]);
    expect(parsed).toEqual([{ slot: 1, name: "Nour", language: "ar", selected: true }]);
  });

  it("returns nothing for anything that is not a list", () => {
    expect(readVoiceOptions(null)).toEqual([]);
    expect(readVoiceOptions({ slot: 1 })).toEqual([]);
  });

  it("only accepts a row id this build could have sent", () => {
    expect(readVoiceRowId("voice_pick_0")).toBe(0);
    expect(readVoiceRowId("voice_pick_8")).toBe(8);
    expect(readVoiceRowId("voice_pick_9")).toBeNull();   // beyond the ceiling
    expect(readVoiceRowId("voice_pick_-1")).toBeNull();
    expect(readVoiceRowId("voice_pick_1x")).toBeNull();
    expect(readVoiceRowId("language_en")).toBeNull();
    expect(readVoiceRowId(null)).toBeNull();
  });
});

describe("resolving a selection into something that can speak", () => {
  it("passes a cloned voice through with its provider and model", () => {
    expect(readResolvedVoice({ provider: "elevenlabs", voice_id: "el_abc", model: "eleven_multilingual_v2" }))
      .toEqual({ provider: "elevenlabs", voice: "el_abc", model: "eleven_multilingual_v2" });
  });

  it("falls back to the default whenever there is nothing usable", () => {
    // Null is the default voice, and every one of these is a case where a reply
    // still has to go out.
    expect(readResolvedVoice(null)).toBeNull();
    expect(readResolvedVoice({ provider: "elevenlabs", voice_id: "" })).toBeNull();
    expect(readResolvedVoice({ provider: "elevenlabs" })).toBeNull();
    expect(readResolvedVoice({ provider: "openai", voice_id: "nova" })).toBeNull();
  });

  it("supplies the model when the row has none", () => {
    expect(readResolvedVoice({ provider: "elevenlabs", voice_id: "el_abc" })?.model)
      .toBe("eleven_multilingual_v2");
  });
});

describe("what the sender is told", () => {
  it("confirms by naming the voice, not the row that was tapped", () => {
    // The list can shift between being sent and being tapped. Naming what was
    // actually selected is how that becomes visible instead of silent.
    expect(voiceSelectedNotice("Nour", "en")).toContain("Nour");
    expect(voiceSelectedNotice(null, "en")).not.toContain("{name}");
  });

  it("leaves no placeholder unfilled in any language", () => {
    for (const language of SUPPORTED_LANGUAGES) {
      expect(voiceSelectedNotice("Nour", language), language).toContain("Nour");
      expect(voiceSelectedNotice("Nour", language), language).not.toContain("{name}");
      expect(voiceSelectedNotice(null, language), language).not.toContain("{name}");
    }
  });

  it("speaks all twenty languages, with nothing falling back to English", () => {
    // A sender who chose Bengali and is answered in English has been told the
    // feature is not for them. Every notice is checked, in every language.
    const notices = [voiceGoneNotice, noVoicesNotice, voiceNeedsAccountNotice];
    for (const notice of notices) {
      const english = notice("en");
      for (const language of SUPPORTED_LANGUAGES) {
        const text = notice(language);
        expect(text.trim().length, `${language} is empty`).toBeGreaterThan(0);
        if (language !== "en") {
          expect(text, `${language} fell back to English`).not.toBe(english);
        }
      }
    }
  });

  it("gives every language its own list labels too", () => {
    const seen = new Set<string>();
    for (const language of SUPPORTED_LANGUAGES) {
      const rows = voiceChoiceRows([option(1, "Nour")], language);
      expect(rows[0].title.length).toBeGreaterThan(0);
      expect(rows[0].description?.length ?? 0).toBeGreaterThan(0);
      seen.add(rows[0].title);
    }
    // Twenty languages, and no two sharing one label by accident of fallback.
    expect(seen.size).toBeGreaterThanOrEqual(SUPPORTED_LANGUAGES.length - 1);
  });

  it("keeps every row title inside Meta's limit once rendered", () => {
    // 24 characters for a row title. The renderer clips, but a label that only
    // survives by being clipped is a label nobody can read aloud.
    for (const language of SUPPORTED_LANGUAGES) {
      const rows = voiceChoiceRows([option(1, "Nour")], language);
      expect([...rows[0].title].length, `${language} default row`).toBeLessThanOrEqual(24);
    }
  });
});

// ── The migration, and what it must keep saying ─────────────────────────────

describe("the consent migration", () => {
  const sql = readFileSync("supabase/migrations/20260929000000_voice_cloning_consent.sql", "utf8");

  it("derives the state rather than letting anything write it", () => {
    // A derived state that can be set is a derived state that will disagree
    // with the columns it came from.
    expect(sql).toMatch(/voice_state text\s*\n?\s*GENERATED ALWAYS AS/);
    expect(sql).toContain("STORED");
  });

  it("defaults existing rows to 'pending', never to a consent nobody gave", () => {
    expect(sql).toMatch(/consent_status text NOT NULL DEFAULT 'pending'/);
  });

  it("keeps the three service-role RPCs revoked from PUBLIC and granted back", () => {
    // REVOKE ... FROM PUBLIC also revokes service_role. Without the grant every
    // call fails in production.
    for (const fn of ["whatsapp_voice_options(text)", "whatsapp_select_voice(text, integer)", "whatsapp_resolve_voice(text)"]) {
      expect(sql, fn).toContain(`REVOKE ALL ON FUNCTION public.${fn} FROM PUBLIC;`);
      expect(sql, fn).toContain(`GRANT EXECUTE ON FUNCTION public.${fn} TO service_role;`);
    }
  });

  it("never returns an id of any kind to the conversation", () => {
    // `whatsapp_voice_options` is what builds the menu. If it selected a uuid or
    // a provider voice id, that value would reach a list row.
    const options = sql.slice(
      sql.indexOf("FUNCTION public.whatsapp_voice_options"),
      sql.indexOf("FUNCTION public.whatsapp_select_voice"),
    );
    expect(options).toContain("'slot', v.slot");
    expect(options).not.toContain("provider_voice_id");
    expect(options).not.toMatch(/'(id|user_id|profile_id)',/);
  });

  it("re-checks consent when resolving, not only when selecting", () => {
    // A voice revoked after it was chosen has to stop speaking on the next
    // message, and this query is what decides.
    const resolve = sql.slice(sql.indexOf("FUNCTION public.whatsapp_resolve_voice"));
    expect(resolve).toContain("p.voice_state = 'ready'");
    expect(resolve).toContain("p.whatsapp_enabled");
  });

  it("scopes every RPC to the linked account, so nobody reads another's voices", () => {
    for (const fn of ["whatsapp_voice_options", "whatsapp_select_voice", "whatsapp_resolve_voice"]) {
      const body = sql.slice(sql.indexOf(`FUNCTION public.${fn}`), sql.indexOf(`COMMENT ON FUNCTION public.${fn}`));
      expect(body, fn).toContain("i.wa_phone = _wa_phone");
      expect(body, fn).toContain("i.user_id IS NOT NULL");
    }
    // And the join is on the identity's own user, never on a caller-supplied id.
    expect(sql).toContain("p.user_id = i.user_id");
  });

  it("does not relax the existing owner-only policies", () => {
    expect(sql).not.toMatch(/DROP POLICY/i);
    expect(sql).not.toMatch(/DISABLE ROW LEVEL SECURITY/i);
    expect(sql).not.toMatch(/CREATE POLICY[\s\S]*vs_voice_profiles/i);
  });

  it("carries every limit forward from the definition it replaces", () => {
    // The failure this catches has already happened once in this repository:
    // 20260726000000 added `library-generate-narration` at 20, and
    // 20260728000000 redefined the function without it two days later. Nothing
    // broke — a limit simply became looser, and nobody noticed for months.
    //
    // So the CASE is compared, arm for arm, against the newest definition that
    // came before this one. Anything dropped fails here.
    const previous = readFileSync(
      "supabase/migrations/20260728000000_library_publishing_studio.sql",
      "utf8",
    );
    const arms = (text: string) => {
      const body = text.slice(text.indexOf("_daily_limit := CASE _function_name"));
      return new Map(
        [...body.slice(0, body.indexOf("END;")).matchAll(/WHEN '([^']+)'\s+THEN (\d+)/g)]
          .map((match) => [match[1], Number(match[2])] as const),
      );
    };

    const before = arms(previous);
    const after = arms(sql);

    expect(before.size).toBeGreaterThan(5);
    for (const [name, limit] of before) {
      expect(after.get(name), `${name} was dropped or changed`).toBe(limit);
    }
    // Exactly one arm is new, and it is the one this migration is for.
    const introduced = [...after.keys()].filter((name) => !before.has(name));
    expect(introduced).toEqual(["voice-studio-clone"]);
    expect(after.get("voice-studio-clone")).toBe(5);
  });

  it("meters cloning through the existing limiter and not a second one", () => {
    expect(sql).toContain("WHEN 'voice-studio-clone'   THEN 5");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.check_ai_rate_limit");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.check_ai_rate_limit(UUID, TEXT) TO service_role;");
    // No new usage table, no second log.
    expect(sql).not.toMatch(/CREATE TABLE[\s\S]{0,80}(usage|quota|rate)/i);
  });

  it("does not disable a voice just because its recordings aged out", () => {
    // An earlier draft marked expired rows `lifecycle_state = 'deleting'`, which
    // feeds `voice_state` — every voice whose recordings expired would have
    // silently stopped working. The queue is a predicate now; see
    // `voice-retention.test.ts` for the whole lifecycle.
    expect(sql).not.toContain("vs_sweep_expired_samples");
    const mark = sql.slice(sql.indexOf("FUNCTION public.vs_mark_samples_deleted"));
    expect(mark.slice(0, mark.indexOf("$;"))).not.toContain("lifecycle_state");
  });

  it("clears a sender's selection when the voice is deleted", () => {
    expect(sql).toMatch(/voice_profile_id uuid\s*\n?\s*REFERENCES public\.vs_voice_profiles\(id\) ON DELETE SET NULL/);
  });
});

// ── The edge function, and the two failures it used to have ─────────────────

describe("the voice-studio function", () => {
  const source = readFileSync("supabase/functions/voice-studio/index.ts", "utf8");

  it("refuses to clone without consent, before anything reaches the provider", () => {
    const start = source.indexOf("async function handleStartTraining");
    const body = source.slice(start, source.indexOf("async function runTraining"));
    expect(body).toContain("mayStartCloning(");
    expect(body.indexOf("mayStartCloning(")).toBeLessThan(body.indexOf("EdgeRuntime.waitUntil"));
  });

  it("charges the existing meter before cloning, and fails closed", () => {
    expect(source).toContain(`_function_name: "voice-studio-clone"`);
    expect(source).toContain("check_ai_rate_limit");
    expect(source).toMatch(/if \(limitError \|\| allowed === false\)/);
  });

  it("no longer swallows what the provider said about a deletion", () => {
    // This used to be `.catch(() => null)` followed by `ok: true`.
    expect(source).not.toContain(".deleteVoice(profile.provider_voice_id).catch");
    expect(source).toContain("Promise<ProviderDeletion>");
    expect(source).toContain("deletionOutcome(");
  });

  it("actually removes the stored recordings, not only their rows", () => {
    // One removal helper, shared with the retention drainer, so "already gone
    // counts as deleted" is decided once.
    expect(source).toContain(`storage.from("voice-datasets").remove(paths)`);
    const fn = source.slice(
      source.indexOf("async function removeSamples"),
      source.indexOf("// ── Retention drainer"),
    );
    expect(fn).toContain("samples_deleted_at");

    // The rows are the only record of what to delete, so the objects go first.
    // Deleting the rows first would leave audio of a real person in a bucket
    // with nothing left pointing at it.
    const objectsAt = fn.indexOf("removeStorageObjects(db, paths)");
    const rowsAt = fn.indexOf(".delete()");
    expect(objectsAt).toBeGreaterThan(-1);
    expect(rowsAt).toBeGreaterThan(-1);
    expect(objectsAt).toBeLessThan(rowsAt);
  });

  it("keeps the row when a deletion is incomplete, so it can be retried", () => {
    const fn = source.slice(source.indexOf("async function handleDeleteProfile"));
    const failure = fn.slice(fn.indexOf(`if (outcome.deletion === "incomplete")`));
    expect(failure).toContain(`lifecycle_state: "error"`);
    expect(failure).toContain("provider_delete_error");
    expect(failure.slice(0, failure.indexOf("return json"))).not.toContain(".delete()");
  });

  it("scopes every write to the owner, on top of RLS", () => {
    const fn = source.slice(source.indexOf("async function handleDeleteProfile"));
    expect((fn.match(/\.eq\("user_id", userId\)/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it("logs no filename, no sample and no key", () => {
    // A path in this bucket is `<user id>/<filename>`.
    const logs = source.match(/console\.(log|error|warn)\([^)]*\)/g) ?? [];
    for (const line of logs) {
      expect(line, line).not.toMatch(/storage_path|paths\[|filename|apiKey|xi-api-key|ELEVENLABS_API_KEY\b\s*\)/);
    }
  });
});

describe("the WhatsApp reply path", () => {
  const source = readFileSync("supabase/functions/_shared/whatsappVoiceReply.ts", "utf8");
  const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");

  it("still speaks through the one shared seam, with no second implementation", () => {
    expect(source).toContain(`import { synthesize } from "./voice/tts.ts";`);
    expect(source).not.toContain("api.openai.com/v1/audio/speech");
    expect(source).not.toContain("api.elevenlabs.io");
  });

  it("defaults to the voice it always used when nothing was chosen", () => {
    expect(source).toContain(`provider: "openai"`);
    expect(source).toContain("voice: DEFAULT_VOICE");
    expect(source).toContain("model: SPEECH_MODEL");
  });

  it("puts the provider, voice and model into the cache key", () => {
    // Otherwise a sender who chose a cloned voice is handed the audio the
    // default voice produced for the same sentence.
    const key = source.slice(source.indexOf("await speechCacheKey({"));
    expect(key).toContain("provider: chosenVoice.provider");
    expect(key).toContain("voice: chosenVoice.voice");
    expect(key).toContain("model: chosenVoice.model");
  });

  it("resolves the sender's voice on every delivery rather than trusting a store", () => {
    expect(webhook).toContain(`db.rpc("whatsapp_resolve_voice"`);
    expect(webhook).toContain("resolveSenderVoice(incoming.from)");
  });

  it("never logs a provider voice id", () => {
    const resolver = webhook.slice(webhook.indexOf("const resolveSenderVoice"));
    const block = resolver.slice(0, resolver.indexOf("};"));
    expect(block).not.toMatch(/console\.[a-z]+\([^)]*(resolved|voice_id|data)\b/);
  });
});

describe("the voice RPCs are reachable only by service_role", () => {
  const fix = readFileSync(
    "supabase/migrations/20260930000000_voice_rpc_isolation_fix.sql",
    "utf8",
  );

  const PRIVILEGED = [
    "whatsapp_voice_options",
    "whatsapp_select_voice",
    "whatsapp_resolve_voice",
    "vs_expired_sample_batch",
    "vs_mark_samples_deleted",
    "vs_mark_samples_delete_failed",
  ];

  it("revokes from anon and authenticated, not only from PUBLIC", () => {
    // `REVOKE ... FROM PUBLIC` reads like isolation and is not: Supabase grants
    // EXECUTE on public-schema functions to `anon` and `authenticated`
    // explicitly, and revoking from PUBLIC leaves a named grant standing. All
    // six of these were callable with the publishable key in production until
    // this migration — two of them mutating, one destroying another user's rows.
    expect(fix).toContain("FROM PUBLIC, anon, authenticated");
    expect(fix).toContain("GRANT EXECUTE ON FUNCTION %s TO service_role");
  });

  it("covers every privileged voice function by name", () => {
    for (const name of PRIVILEGED) {
      expect(fix, name).toContain(`'${name}'`);
    }
  });

  it("fails loudly when a name matches nothing", () => {
    // A renamed function that silently protects nothing is how the original
    // defect survived a review.
    expect(fix).toMatch(/RAISE EXCEPTION/);
  });

  it("reads signatures from the catalogue so overloads cannot be missed", () => {
    expect(fix).toContain("p.oid::regprocedure");
  });
});
