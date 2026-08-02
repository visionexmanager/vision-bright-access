import { describe, expect, it } from "vitest";
import { validateAudioAsset } from "./audioQuality";
import { AUDIO_LIBRARY } from "./audioLibrary";
import { createAudioQualityReport } from "./audioQualityReport";
import type { AudioAssetDefinition } from "./types";

const approved: AudioAssetDefinition = {
  id:"wood-piece-place", name:"Wood piece", gameIds:["visionopoly"], category:"game-effect", channel:"effects",
  quality:"production", licenseStatus:"approved", license:"Exclusive commercial license", sourceAttribution:"Visionex commissioned studio recording",
  normalizedLufs:-18, sources:[{ src:"/audio/wood-piece.opus", codec:"opus", bitrateKbps:192, sampleRateHz:48_000 }],
};

describe("Arcade audio quality gate", () => {
  it("accepts licensed, mastered, high-resolution audio", () => {
    expect(validateAudioAsset(approved)).toEqual({ valid:true, errors:[], warnings:[] });
  });

  it("rejects preview-quality or unlicensed assets", () => {
    const result = validateAudioAsset({ ...approved, quality:"replacement-required", licenseStatus:"pending", sources:[] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("License is not approved");
    expect(result.errors).toContain("No audio source is registered");
  });

  it("rejects low sample rates and warns on low compressed bitrates", () => {
    const result = validateAudioAsset({ ...approved, sources:[{ src:"/bad.mp3", codec:"mp3", bitrateKbps:96, sampleRateHz:22_050 }] });
    expect(result.valid).toBe(false);
    expect(result.warnings).toContain("Compressed source is below 160 kbps");
  });

  it("covers every required audio category", () => {
    expect(new Set(AUDIO_LIBRARY.map((asset) => asset.category))).toEqual(new Set([
      "ui", "button", "game-effect", "environment", "character", "victory", "failure", "narration", "music",
    ]));
  });

  it("reports approved and pending production slots independently", () => {
    const report = createAudioQualityReport();
    expect(report.total).toBe(AUDIO_LIBRARY.length);
    expect(report.approved).toBe(13);
    expect(report.blocked).toBe(report.total - report.approved);
    expect(report.replacementRequired).toHaveLength(report.blocked);
  });
});
