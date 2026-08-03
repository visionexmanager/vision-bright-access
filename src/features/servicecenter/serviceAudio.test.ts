import { describe, expect, it } from "vitest";
import {
  SERVICE_AUDIO_ASSETS,
  auditAudioCoverage,
  getAudioAsset,
  isPlayable,
} from "./serviceAudio";
import { getPersona, PERSONAS, personaChatContext } from "./personas";
import { SERVICE_CATALOG } from "./catalog";

describe("service audio registry", () => {
  it("declares every ambience and cue the catalog references", () => {
    const report = auditAudioCoverage();
    expect(report.missing, `undeclared audio ids: ${report.missing.join(", ")}`).toEqual([]);
    expect(report.totalReferenced).toBeGreaterThan(0);
  });

  it("has unique asset ids", () => {
    const ids = SERVICE_AUDIO_ASSETS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("refuses to mark unlicensed or missing files as playable", () => {
    for (const asset of SERVICE_AUDIO_ASSETS) {
      if (asset.licenseStatus !== "approved" || asset.src === "") {
        expect(isPlayable(asset), asset.id).toBe(false);
      }
    }
  });

  it("treats an unknown id as not playable rather than throwing", () => {
    expect(isPlayable(getAudioAsset("does-not-exist"))).toBe(false);
  });

  it("briefs every asset in both languages", () => {
    for (const asset of SERVICE_AUDIO_ASSETS) {
      expect(asset.brief.en.trim(), asset.id).not.toBe("");
      expect(asset.brief.ar.trim(), asset.id).not.toBe("");
    }
  });

  it("gives every meaningful alarm a text announcement for sound-off users", () => {
    const mustAnnounce = SERVICE_AUDIO_ASSETS.filter(
      (a) => a.id.startsWith("alarm-") || a.id.startsWith("alert-")
    );
    expect(mustAnnounce.length).toBeGreaterThan(0);
    for (const asset of mustAnnounce) {
      expect(asset.announce, `${asset.id} carries meaning but has no text equivalent`).toBeDefined();
      expect(asset.announce!.ar.trim()).not.toBe("");
    }
  });

  it("reports honestly that nothing is playable until production delivers", () => {
    const report = auditAudioCoverage();
    expect(report.playable + report.awaitingProduction.length).toBe(report.declared);
  });
});

describe("personas", () => {
  it("resolves every persona referenced by the catalog", () => {
    for (const entry of SERVICE_CATALOG) {
      if (!entry.persona) continue;
      expect(getPersona(entry.persona.id), `${entry.slug} -> ${entry.persona.id}`).toBeDefined();
    }
  });

  it("has unique ids", () => {
    const ids = PERSONAS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every persona a bilingual greeting and opening questions", () => {
    for (const p of PERSONAS) {
      expect(p.greeting.en.trim(), p.id).not.toBe("");
      expect(p.greeting.ar.trim(), p.id).not.toBe("");
      expect(p.openingQuestions.en.length, p.id).toBeGreaterThan(0);
      expect(p.openingQuestions.en.length, p.id).toBe(p.openingQuestions.ar.length);
    }
  });

  it("gives health and legal personas an explicit human handoff", () => {
    expect(getPersona("clinician")?.handoff).toBeDefined();
    expect(getPersona("business-consultant")?.handoff).toBeDefined();
  });

  it("builds chat context in the requested language", () => {
    const persona = getPersona("mechanic")!;
    const en = personaChatContext(persona, "Vehicle Diagnostics", "en");
    const ar = personaChatContext(persona, "تشخيص المركبات", "ar");
    expect(en.productName).toContain("AI Master Mechanic");
    expect(en.currentStep).toBe(persona.brief.en);
    expect(ar.currentStep).toBe(persona.brief.ar);
    expect(ar.productName).toContain(persona.role.ar);
  });

  it("returns undefined for an unknown persona instead of throwing", () => {
    expect(getPersona("nope")).toBeUndefined();
    expect(getPersona(undefined)).toBeUndefined();
  });
});
