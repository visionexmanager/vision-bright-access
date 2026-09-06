// ─── What is in this medicine, from the label that was approved ─────────────
//
// Two sources, both public, both free, and — the reason they were chosen over
// anything else — **neither takes a key**. This channel's rule is that a
// service it depends on must not need one: a key is a bill, a quota and an
// outage, and a health answer that stops working because a plan lapsed is
// worse than no health answer at all.
//
//   openFDA      api.fda.gov — the text of the approved US label: what it is
//                for, the directions, the warnings, when to stop and ask.
//   RxNav        rxnav.nlm.nih.gov — the US National Library of Medicine's
//                drug vocabulary, used here only to rescue a misspelling.
//                "panadool" resolves to "Panadol" and the search runs again.
//
// ── What this is not ───────────────────────────────────────────────────────
//
// It is not advice, it is not a prescription, and it is not a substitute for a
// pharmacist. The disclaimer is written by `whatsappStrings.ts` and appended by
// code — never by the model — so no rendering can drop it, shorten it or argue
// with it.
//
// ── The caveat that is easy to miss ────────────────────────────────────────
//
// These are *US* labels. A brand name means different things in different
// countries: "Panadol" is paracetamol across the Middle East, and the first
// openFDA match for it is "PANADOL PM", which is paracetamol *and* an
// antihistamine. That is exactly the kind of difference that matters, and it is
// why the disclaimer names the country of the label and tells the reader to
// check with their pharmacist rather than implying the box in their hand is the
// one described here.
//
// Pure: no `Deno`, no fetch, no database. The two lookups are handed in.

import type { Language } from "./whatsappCatalog.ts";
import { say } from "./whatsappStrings.ts";

/** Longest a message can be and still be read as asking about a medicine. */
export const MEDICINE_MAX_CHARS = 60;

/**
 * How long either lookup may take.
 *
 * Short, because Meta redelivers a webhook that does not answer promptly and
 * two lookups run in sequence. A leaflet that arrives after the redelivery has
 * already started is a leaflet sent twice.
 */
export const MEDICINE_TIMEOUT_MS = 6_000;

/** A trigger has to open the message, within this many words. */
const TRIGGER_WITHIN_WORDS = 3;

/** How much of one label section is worth sending. */
export const SECTION_CHARS = 700;

/** The whole source block handed to the renderer. */
export const SOURCE_CHARS = 2_600;

/**
 * The words that open a question about a medicine.
 *
 * Anchored to the start for the reason the song parser is: "I took some
 * medicine and now I feel worse" is a complaint, and answering it with a
 * leaflet would be the assistant talking over somebody who needs a person.
 */
const MEDICINE_WORDS: readonly RegExp[] = [
  /^(?:ال)?(?:دواء|دوا|علاج)$/u,
  /^معلومات عن$/u,
  /^معلومات عن دواء$/u,
  /^ما هو دواء$/u,
  /^شو دواء$/u,
  /^medicine$/i,
  /^medication$/i,
  /^drug$/i,
  /^what is the drug$/i,
];

export interface MedicineRequest {
  /** Empty when the trigger arrived with no name after it. */
  name: string;
}

/**
 * Whether this message asks about a medicine, and which one.
 *
 * An empty name is a real answer rather than a refusal: "دواء" on its own is
 * somebody who has found the feature and not yet said what they want, and the
 * webhook asks them. That is the same shape `parseSongRequest` returns for the
 * same reason.
 */
export function parseMedicineRequest(text: string | null | undefined): MedicineRequest | null {
  const raw = (text ?? "").trim();
  if (!raw || raw.length > MEDICINE_MAX_CHARS) return null;

  const words = raw
    .replace(/[^\p{L}\p{N}\s'’-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  if (words.length === 0) return null;

  // Longest trigger first. «معلومات عن دواء اسبرين» opens with two triggers,
  // one inside the other, and taking the shorter one leaves «دواء» sitting at
  // the front of the drug name — which is then looked up as part of it and
  // found nowhere.
  for (let end = Math.min(TRIGGER_WITHIN_WORDS, words.length) - 1; end >= 0; end--) {
    const opening = words.slice(0, end + 1).join(" ");
    if (MEDICINE_WORDS.some((pattern) => pattern.test(opening))) {
      return { name: words.slice(end + 1).join(" ").trim() };
    }
  }
  return null;
}

/** The sections of a label worth reading to somebody, in the order they matter. */
export interface MedicineLabel {
  brand: string;
  generic: string;
  sections: Array<{ key: SectionKey; text: string }>;
}

export type SectionKey =
  | "uses"
  | "directions"
  | "warnings"
  | "whenUsing"
  | "stopUse"
  | "askDoctor"
  | "interactions";

/**
 * Which openFDA fields become which section.
 *
 * Ordered by what somebody holding the box actually needs, which is not the
 * order the label prints them in: what it is for, how much, then everything
 * that is a reason to stop or to ask.
 */
const SECTION_FIELDS: ReadonlyArray<{ key: SectionKey; field: string }> = [
  { key: "uses", field: "indications_and_usage" },
  { key: "directions", field: "dosage_and_administration" },
  { key: "warnings", field: "warnings" },
  { key: "interactions", field: "drug_interactions" },
  { key: "whenUsing", field: "when_using" },
  { key: "stopUse", field: "stop_use" },
  { key: "askDoctor", field: "ask_doctor" },
];

const firstString = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value) && typeof value[0] === "string") return value[0].trim();
  return "";
};

/** Collapse the whitespace a label is full of, and cap it. */
const tidy = (text: string, limit: number): string =>
  text.replace(/\s+/g, " ").trim().slice(0, limit).trim();

/**
 * One label out of whatever openFDA returned.
 *
 * Defensive in the way the news and story readers are: this is somebody else's
 * data and a missing field is normal, not an error. A result with no readable
 * section at all is `null` rather than an empty leaflet.
 */
export function readLabel(payload: unknown): MedicineLabel | null {
  const results = (payload as { results?: unknown } | null)?.results;
  if (!Array.isArray(results) || results.length === 0) return null;
  const row = results[0] as Record<string, unknown>;
  const openfda = (row.openfda ?? {}) as Record<string, unknown>;

  const sections: MedicineLabel["sections"] = [];
  for (const { key, field } of SECTION_FIELDS) {
    const text = tidy(firstString(row[field]), SECTION_CHARS);
    if (text) sections.push({ key, text });
  }
  if (sections.length === 0) return null;

  return {
    brand: firstString(openfda.brand_name),
    generic: firstString(openfda.generic_name),
    sections,
  };
}

/** The rxcui a misspelling most likely meant, or null. */
export function readApproximate(payload: unknown): string | null {
  const candidates = (payload as { approximateGroup?: { candidate?: unknown } } | null)
    ?.approximateGroup?.candidate;
  if (!Array.isArray(candidates)) return null;
  for (const candidate of candidates) {
    const rxcui = (candidate as { rxcui?: unknown }).rxcui;
    if (typeof rxcui === "string" && /^[0-9]+$/.test(rxcui)) return rxcui;
  }
  return null;
}

/** The name RxNav holds for an rxcui, or null. */
export function readRxName(payload: unknown): string | null {
  const name = (payload as { properties?: { name?: unknown } } | null)?.properties?.name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

/**
 * The label as one block of source text for the renderer.
 *
 * Section keys are left as English markers rather than translated here: the
 * renderer is told to write the headings in the reader's language, and a
 * heading translated twice — once by this file, once by the model — is a
 * heading that drifts.
 */
export function sourceBlock(label: MedicineLabel): string {
  const name = [label.brand, label.generic].filter(Boolean).join(" / ") || "";
  const lines = name ? [`NAME: ${name}`] : [];
  for (const section of label.sections) {
    lines.push(`${section.key.toUpperCase()}: ${section.text}`);
  }
  return lines.join("\n\n").slice(0, SOURCE_CHARS);
}

/**
 * What the renderer is asked to do, and everything it is not.
 *
 * Written as a constraint list rather than a request because the failure that
 * matters is not a bad translation — it is an invented dose, a softened warning
 * or a sentence of advice that reads as though a clinician wrote it.
 */
export function renderPrompt(languageName: string): string {
  return [
    `Rewrite the medicine leaflet below in ${languageName}, for a patient reading it on a phone.`,
    "Keep every warning. Keep every dose exactly as written.",
    "Do not add anything: no advice, no reassurance, no dose, no condition, no interaction that is not in the text.",
    "Do not tell the reader what to take or whether to take it.",
    "Write a short heading for each section in that same language, then its content in plain sentences.",
    "At most 120 words per section. No markdown tables, no lists of asterisks.",
  ].join(" ");
}

/**
 * The message, with the disclaimer added by code.
 *
 * Appended here rather than asked for, so that no rendering — however it goes
 * wrong — can drop it, shorten it, or place it where somebody stops reading
 * before they reach it.
 */
export function withDisclaimer(body: string, language: Language): string {
  return `${body.trim()}\n\n${say("medicineDisclaimer", language)}`;
}

/** The heading a leaflet is sent under. */
export function medicineHeading(label: MedicineLabel): string {
  const name = label.brand || label.generic;
  const other = label.brand && label.generic && label.brand !== label.generic ? label.generic : "";
  return other ? `💊 *${name}* (${other})` : `💊 *${name}*`;
}
