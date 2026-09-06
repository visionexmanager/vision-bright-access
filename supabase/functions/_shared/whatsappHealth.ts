// ─── Getting somebody to care, quickly ──────────────────────────────────────
//
// The map already knows where the hospitals are: `services.nearby` has had
// `hospital`, `clinic` and `pharmacy` as categories since it shipped, it reads
// OpenStreetMap without a key, and tapping a result sends the pin. None of that
// is rebuilt here.
//
// What this adds is the one request that must not be answered like the others.
// "طوارئ" is not a browse — it is somebody who needs a hospital now, possibly
// dictating into a phone they cannot see, possibly for somebody else. So it
// skips the category question, asks the map for hospitals only, and says the
// one thing this assistant must always say in that moment: if it is
// life-threatening, call the emergency number rather than reading a list.
//
// ── Why no emergency number is printed ──────────────────────────────────────
//
// This assistant serves 199 countries. A wrong emergency number, given to
// somebody in the minute they need the right one, is a worse failure than any
// other this system can produce, and there is no source for 199 of them that
// this repository can vouch for. So the sentence names the thing to do without
// inventing the digits, and the concrete help — a hospital, with its location —
// is the part that comes from data.
//
// Pure. No `Deno`, no fetch, no database.

/**
 * Longest a message can be and still be read as asking for emergency care.
 *
 * Wider than the other parsers on purpose. A false positive here hands somebody
 * a list of hospitals they did not ask for, which is an annoyance; a false
 * negative leaves somebody looking for one without it, which is not. The length
 * cap is what keeps that from turning into every sentence containing the word.
 */
export const EMERGENCY_MAX_CHARS = 60;

/**
 * The words, in the two languages the parsers read.
 *
 * A whole word, never a fragment: «طوارئ» must not be found inside a longer
 * word, and "emergency" must not match "emergencies of the plot". The Arabic
 * definite article is allowed in front because «الطوارئ» is how it is normally
 * said.
 */
const EMERGENCY_WORDS = [
  /(?:^|\s)(?:ال)?(?:طوارئ|طوارىء|اسعاف|إسعاف|الإسعاف)(?:\s|$|[.!?،؟])/u,
  /\b(?:emergency|emergencies|ambulance|urgent\s+care|a&e|er)\b/iu,
  /\b(?:acil|urgence|urgencia|notfall|emergenza|скорая|अस्पताल\s+आपातकाल)\b/iu,
];

/**
 * Whether this message is asking for emergency care.
 *
 * Deliberately not the whole-message match the other geography parsers use:
 * somebody in trouble types a sentence, not a keyword. The cap above is what
 * makes that safe — "the emergency exit was blocked at the cinema last night"
 * is too long to reach this, and "بدي طوارئ" is not.
 */
export function asksForEmergencyCare(text: string | null | undefined): boolean {
  const value = (text ?? "").trim();
  if (!value || value.length > EMERGENCY_MAX_CHARS) return false;
  return EMERGENCY_WORDS.some((pattern) => pattern.test(value));
}

// ── Reading a report, and the line this assistant does not cross ────────────
//
// A lab result or a radiologist's report is a page of terminology written for
// another clinician. Somebody holding one — especially somebody who cannot see
// it and is having it read to them — is entitled to know what the words mean.
// That is what this does.
//
// It does not say what the findings mean *for them*. Not whether it is serious,
// not what happens next, not whether the treatment is right. That is a
// diagnosis, it belongs to a doctor who has examined them, and an assistant
// that offers one is wrong in the direction that costs the most.
//
// ── And it does not read the scan itself ───────────────────────────────────
//
// An X-ray, a CT, an MRI, an ultrasound: the image. Software that tells a
// patient what is in one is a medical device in most of the world, and a missed
// fracture reaches a person directly. So the instruction below tells the model
// to say plainly that it cannot interpret the picture and that the written
// report is what can be explained — said by the model, because the model is
// what can tell an image of a scan from a photograph of a page.

/** Longest a caption can be and still be read as asking for an explanation. */
export const REPORT_MAX_CHARS = 80;

const REPORT_WORDS: readonly RegExp[] = [
  /(?:^|\s)(?:اشرح|فسر|فسّر|وضح|وضّح)(?:\s|$)/u,
  /(?:^|\s)(?:تقرير|التقرير|تحليل|التحليل|فحص|الفحص|نتيجة|نتائج)(?:\s|$)/u,
  /\b(?:explain|what does this (?:report|result|test)|medical report|lab result|blood test|test result)\b/i,
  /\b(?:rapport médical|informe médico|befund|referto|раз(?:бор|бери)|tıbbi rapor)\b/i,
];

/**
 * Whether this caption asks for a medical report to be explained.
 *
 * A caption, not a message: it arrives attached to a file, which is most of the
 * evidence that this is what somebody wants. The word list is still narrow
 * enough that "here is the report you asked for, thanks" does not arm it — and
 * the cap keeps a paragraph from doing so.
 */
export function asksToExplainReport(text: string | null | undefined): boolean {
  const value = (text ?? "").trim();
  if (!value || value.length > REPORT_MAX_CHARS) return false;
  return REPORT_WORDS.some((pattern) => pattern.test(value));
}

/**
 * What the reader is told about their report, and everything they are not.
 *
 * Written as constraints rather than as a request, for the same reason the
 * medicine renderer is: the failure that matters is not a clumsy explanation,
 * it is a confident sentence about what a finding means for the person holding
 * it.
 */
export function reportPrompt(languageName: string): string {
  return [
    `Explain what the words, abbreviations and measurements in this medical document mean, in ${languageName}, for the patient it belongs to.`,
    "Explain terminology only.",
    "Do not diagnose. Do not say what any finding means for this person, whether it is serious, what caused it, or what will happen next.",
    "Do not recommend, suggest or rule out any treatment, test, medicine or dose.",
    "If the document marks a value as outside its own reference range, you may say that the document marks it so — never what that implies.",
    "If this is a picture of a scan itself — an X-ray, CT, MRI or ultrasound image — say in one sentence that you cannot interpret images of scans, and that the radiologist's written report is what can be explained. Then stop.",
    "If this is not a medical document at all, say so in one sentence and stop.",
    "End with two or three short questions the reader could ask their doctor.",
  ].join(" ");
}

/**
 * The category the map is asked for when somebody asks for emergency care.
 *
 * Hospitals only. A pharmacy is not an emergency room and a clinic may be shut,
 * and a list mixing the three costs somebody time they are least able to spend
 * — the other categories are one message away for anybody who wants them.
 */
export const EMERGENCY_CATEGORY = "hospital";
