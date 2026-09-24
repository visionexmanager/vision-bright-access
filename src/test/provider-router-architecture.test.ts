// providerRouter.ts's own semantics, which had no coverage at all before this
// file: selection is not execution, and recording is not selection. Asserted
// against the source, the same convention `runpod-provider-layer.test.ts` and
// `content-media.test.ts` already use for a Deno-native module with no
// injected dependencies to mock — every function here builds its own
// `createClient()` inline, so there is nothing to import and drive without a
// live database. That absence of a test seam is itself a Phase 2A finding,
// not something this file works around by rewriting production code.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const router = readFileSync("supabase/functions/_shared/providerRouter.ts", "utf8");
// Phase 2J-2 moved the ranking (eligibility, preference, score) unchanged into
// providerSelection.ts; resolveProvider queries and delegates to it.
const ranking = readFileSync("supabase/functions/_shared/providerSelection.ts", "utf8");
const speechGenerate = readFileSync("supabase/functions/speech-generate/index.ts", "utf8");
const voiceStudio = readFileSync("supabase/functions/voice-studio/index.ts", "utf8");

describe("resolveProvider selects a row; it does not execute a request", () => {
  it("filters to the requested type and drops inactive rows before scoring", () => {
    expect(router).toContain('.eq("type", type)');
    expect(router).toContain('.neq("status", "inactive")');
  });

  it("treats only a healthy row as eligible", () => {
    expect(router).toContain("return rankProviders(providers as RouterProvider[], prefs);");
    expect(ranking).toContain("p.health_score > 20");
  });

  it("honours an eligible preferredSlug outright, without scoring it against the rest", () => {
    const at = ranking.indexOf("if (prefs?.preferredSlug)");
    const block = ranking.slice(at, ranking.indexOf("eligible.sort", at));
    expect(at).toBeGreaterThan(-1);
    expect(block).toContain("eligible.find");
    expect(block).not.toContain("scoreProvider");
  });

  it("falls through to scoring only once no preference was honoured", () => {
    const prefAt = ranking.indexOf("if (prefs?.preferredSlug)");
    const scoreAt = ranking.indexOf("eligible.sort((a, b) => scoreProvider(b) - scoreProvider(a))");
    expect(scoreAt).toBeGreaterThan(prefAt);
  });

  it("has no retry loop of its own — one lookup, one answer", () => {
    // aiProvider.ts's *WithFallback functions retry across an ordered target
    // list on failure; resolveProvider() does not. It is easy to assume the
    // two systems behave alike because they sit next to each other in the
    // audit's diagrams — this is the assertion that they do not.
    const fn = router.slice(
      router.indexOf("export async function resolveProvider"),
      router.indexOf("export async function recordResult"),
    );
    expect((fn.match(/\.from\("ph_providers"\)/g) ?? []).length).toBe(1);
  });
});

describe("providerBySlug exists to record against reality, not to select", () => {
  it("looks up unfiltered by health or status", () => {
    // A provider that actually served a request must stay recordable even if
    // its health score has since dropped below resolveProvider's threshold —
    // otherwise a real result could go unrecorded for the row it happened on.
    const fn = router.slice(router.indexOf("export async function providerBySlug"));
    const body = fn.slice(0, fn.indexOf("\n}"));
    expect(body).not.toContain(".neq(");
    expect(body).not.toContain("health_score");
  });
});

describe("recordResult takes a provider identity; it never re-derives one", () => {
  it("accepts provider_id and provider_slug as parameters rather than calling resolveProvider itself", () => {
    const fn = router.slice(router.indexOf("export async function recordResult"));
    const sig = fn.slice(0, fn.indexOf(")"));
    const body = fn.slice(0, fn.indexOf("\n}\n"));
    // Since Phase 2H the parameter type and the body live in
    // providerRecording.ts; recordResult builds a client and delegates.
    expect(sig).toContain("RecordResultParams");
    expect(body).toContain("recordResultIn(");
    expect(body).not.toContain("resolveProvider(");
    const recording = readFileSync("supabase/functions/_shared/providerRecording.ts", "utf8");
    const params = recording.slice(recording.indexOf("export interface RecordResultParams"));
    expect(params.slice(0, params.indexOf("}"))).toContain("provider_id:");
    expect(params.slice(0, params.indexOf("}"))).toContain("provider_slug:");
    expect(recording).not.toContain("resolveProvider(");
  });
});

describe("callers record against the provider actually used, not the one first selected", () => {
  // The pattern the selection/recording split exists to enforce: after a real
  // call, a caller looks up the row it actually hit (providerBySlug) before
  // recording — it never assumes resolveProvider's original pick is still
  // what ran, since a caller-supplied provider bypasses selection entirely.
  for (const [name, src] of [["speech-generate", speechGenerate], ["voice-studio", voiceStudio]] as const) {
    it(`${name} looks up providerBySlug before recordResult`, () => {
      expect(src).toContain("providerBySlug(");
      expect(src).toContain("recordResult(");
    });
  }

  it("speech-generate's router-backed default never blocks generation on a router fault", () => {
    const fn = speechGenerate.slice(speechGenerate.indexOf("async function defaultTtsProvider"));
    expect(fn.slice(0, fn.indexOf("\n}"))).toMatch(/catch\s*\{/);
  });

  it("voice-studio chooses by environment key and records against the provider that cloned", () => {
    // Not a gap: ElevenLabs when its key is set, otherwise Mistral — a rule on
    // configuration, not a ranking — and recording is still real, against the
    // row of whichever provider actually cloned. This documents that as
    // intentional so a future reader does not "fix" a resolveProvider call in.
    expect(voiceStudio).not.toContain("resolveProvider(");
    expect(voiceStudio).toContain('providerBySlug(params.provider === "mistral" ? "mistral-vc" : "elevenlabs-vc")');
  });
});
