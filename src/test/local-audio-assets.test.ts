// The clips shipped in assets/local-audio/voice-prompts must be the ones the manifest describes.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LOCAL_AUDIO_ASSETS, LOCAL_RESPONSES } from "../../supabase/functions/_shared/localAudioManifest";
import { matchPhrase } from "../../supabase/functions/_shared/localAudio";

const DIR = "assets/local-audio/voice-prompts";
const provenance: Array<Record<string, unknown>> = JSON.parse(readFileSync(`${DIR}/provenance.json`, "utf8"));

describe("shipped clips", () => {
  const entries = Object.entries(LOCAL_AUDIO_ASSETS);

  it("has every manifest clip on disk with the recorded size and checksum", () => {
    expect(entries.length).toBeGreaterThan(0);
    for (const [name, clip] of entries) {
      expect(existsSync(`${DIR}/${name}`), name).toBe(true);
      const bytes = readFileSync(`${DIR}/${name}`);
      expect(bytes.length, name).toBe(clip.bytes);
      expect(createHash("sha256").update(bytes).digest("hex"), name).toBe(clip.sha256);
      expect(bytes.subarray(0, 4).toString("latin1"), name).toBe("OggS");
    }
  });

  it("has provenance, a CC0 licence and a registered transcript for every clip", () => {
    for (const [name] of entries) {
      const [id, language] = name.replace(/\.ogg$/, "").split(/\.(?=[a-z]{2}$)/);
      const row = provenance.find((p) => p.id === id && p.language === language);
      expect(row, name).toBeTruthy();
      expect(row!.licence, name).toBe("CC0");
      expect(String(row!.source), name).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      expect(matchPhrase(String(row!.transcript), language)?.id, name).toBe(id);
    }
  });

  it("keeps a clip disabled until a person has listened to it", () => {
    for (const [name, clip] of entries) {
      const [id, language] = name.replace(/\.ogg$/, "").split(/\.(?=[a-z]{2}$)/);
      const row = provenance.find((p) => p.id === id && p.language === language);
      if (row?.reviewed !== true) expect(clip.status, name).toBe("disabled");
    }
  });

  it("registers nothing that carries a plan, price or link", () => {
    for (const id of Object.keys(LOCAL_RESPONSES)) expect(id).not.toMatch(/plan|price|subscri|limit|billing/);
  });
});
