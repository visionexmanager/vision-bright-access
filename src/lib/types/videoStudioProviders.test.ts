import { describe, expect, it } from "vitest";
import {
  AUTO_PROVIDER,
  ASPECT_RATIOS,
  DEFAULT_FORM,
  VIDEO_PROVIDERS,
  resolveProviderConfig,
} from "./video-studio";

// The UI must never offer a duration or aspect ratio the provider will reject.
// OpenAI's Videos API 400s on anything outside 4/8/12 seconds and its four
// supported sizes, so these tables are a contract, not a suggestion.

describe("video provider capabilities", () => {
  it("defaults the form to auto provider selection", () => {
    // "auto" lets the edge function pick whichever API key is configured.
    expect(DEFAULT_FORM.provider).toBe(AUTO_PROVIDER);
    expect(DEFAULT_FORM.providerModel).toBe("");
  });

  it("resolves auto and unknown providers to the primary provider", () => {
    expect(resolveProviderConfig(AUTO_PROVIDER).id).toBe(VIDEO_PROVIDERS[0].id);
    // Templates saved against a removed provider must not crash the panel.
    expect(resolveProviderConfig("mock").id).toBe(VIDEO_PROVIDERS[0].id);
    expect(resolveProviderConfig("luma").id).toBe("luma");
  });

  it("keeps the default duration valid for the primary provider", () => {
    const primary = VIDEO_PROVIDERS[0];
    if (primary.allowedDurations) {
      expect(primary.allowedDurations).toContain(DEFAULT_FORM.durationSec);
    } else {
      expect(DEFAULT_FORM.durationSec).toBeLessThanOrEqual(primary.maxDuration);
    }
  });

  it("keeps the default aspect ratio valid for the primary provider", () => {
    const primary = VIDEO_PROVIDERS[0];
    if (primary.allowedAspectRatios) {
      expect(primary.allowedAspectRatios).toContain(DEFAULT_FORM.aspectRatio);
    }
  });

  it("declares OpenAI Sora with exactly the durations and sizes the API accepts", () => {
    const openai = VIDEO_PROVIDERS.find((p) => p.id === "openai");
    expect(openai).toBeDefined();
    expect(openai!.requiresKey).toBe("OPENAI_API_KEY");
    expect(openai!.allowedDurations).toEqual([4, 8, 12]);
    // Sora renders landscape or portrait only — no square or ultrawide.
    expect(openai!.allowedAspectRatios).toEqual(["16:9", "9:16"]);
    expect(openai!.models.map((m) => m.id)).toEqual(["sora-2", "sora-2-pro"]);
  });

  it("keeps every provider's allowed values within the shared option tables", () => {
    const knownRatios = new Set(ASPECT_RATIOS.map((a) => a.value));
    for (const provider of VIDEO_PROVIDERS) {
      for (const ratio of provider.allowedAspectRatios ?? []) {
        expect(knownRatios).toContain(ratio);
      }
      for (const seconds of provider.allowedDurations ?? []) {
        expect(seconds).toBeLessThanOrEqual(provider.maxDuration);
      }
    }
  });

  it("still offers Luma as the migration path off the deprecated Videos API", () => {
    // OpenAI removes the Videos API on 2026-09-24 — see
    // docs/video-studio-providers.md. Luma must stay wired as the fallback.
    const luma = VIDEO_PROVIDERS.find((p) => p.id === "luma");
    expect(luma).toBeDefined();
    expect(luma!.requiresKey).toBe("LUMA_API_KEY");
  });
});
