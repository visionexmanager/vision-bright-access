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

/**
 * The category the map is asked for when somebody asks for emergency care.
 *
 * Hospitals only. A pharmacy is not an emergency room and a clinic may be shut,
 * and a list mixing the three costs somebody time they are least able to spend
 * — the other categories are one message away for anybody who wants them.
 */
export const EMERGENCY_CATEGORY = "hospital";
