// Word and character error rate, with the normalisation Arabic actually needs.
//
// No dependency: this is an edit distance and a tokeniser, and pulling a package
// in for that would put a supply-chain decision in front of a measurement.
//
// ── Why two modes ───────────────────────────────────────────────────────────
//
// `raw` compares what the provider returned against the reference as written.
// `normalised` first folds the differences that are orthographic rather than
// semantic: diacritics, tatweel, the alef and yeh variants an Arabic keyboard
// produces interchangeably, teh marbuta, Arabic-Indic digits, and punctuation.
//
// Reporting only `raw` would make every Arabic provider look worse than it is —
// «هذه» and «هٰذه» are the same word. Reporting only `normalised` would hide a
// provider that never writes hamza correctly, which matters for a screen reader.
// So both are always reported, and neither is presented as *the* number.

/** Combining marks, tatweel, and the Quranic annotation range. */
const ARABIC_DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

/** Arabic-Indic and Persian digits, folded to the ones a reference is written in. */
export function foldDigits(text) {
  return text
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/**
 * Fold what does not change which word was said.
 *
 * Deliberately not a stemmer: «كتاب» and «كتب» stay different words. What is
 * removed is orthographic noise — the same folding `normaliseAlias` applies in
 * the WhatsApp router, plus diacritics, which a transcriber may or may not emit.
 */
export function normalizeText(text) {
  return foldDigits(String(text ?? ""))
    .normalize("NFKC")
    .toLowerCase()
    .replace(ARABIC_DIACRITICS, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Whitespace-collapsed only. What the provider actually wrote. */
export function rawText(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

const prepare = (text, mode) => (mode === "normalized" ? normalizeText(text) : rawText(text));

/**
 * Edit distance over any two sequences, with the operation counts.
 *
 * Counts matter more than the total here: a provider that only ever
 * substitutes is mishearing words, while one that deletes is dropping speech,
 * and the two point at different problems.
 */
export function editDistance(reference, hypothesis) {
  const rows = reference.length + 1;
  const cols = hypothesis.length + 1;
  // [distance, substitutions, deletions, insertions] per cell.
  let previous = Array.from({ length: cols }, (_, j) => [j, 0, 0, j]);

  for (let i = 1; i < rows; i++) {
    const current = [[i, 0, i, 0]];
    for (let j = 1; j < cols; j++) {
      if (reference[i - 1] === hypothesis[j - 1]) {
        current[j] = [...previous[j - 1]];
        continue;
      }
      const substitute = previous[j - 1];
      const deletion = previous[j];
      const insertion = current[j - 1];
      const best = [substitute, deletion, insertion]
        .reduce((a, b) => (a[0] <= b[0] ? a : b));
      if (best === substitute) current[j] = [best[0] + 1, best[1] + 1, best[2], best[3]];
      else if (best === deletion) current[j] = [best[0] + 1, best[1], best[2] + 1, best[3]];
      else current[j] = [best[0] + 1, best[1], best[2], best[3] + 1];
    }
    previous = current;
  }

  const [distance, substitutions, deletions, insertions] = previous[cols - 1];
  return { distance, substitutions, deletions, insertions };
}

function rate(referenceUnits, hypothesisUnits) {
  const counts = editDistance(referenceUnits, hypothesisUnits);
  // An empty reference with any output is a total error rather than a divide by
  // zero; an empty reference with empty output is a perfect score.
  const denominator = referenceUnits.length;
  const value = denominator === 0
    ? (hypothesisUnits.length === 0 ? 0 : 1)
    : counts.distance / denominator;
  return { ...counts, units: denominator, rate: value };
}

/** Word error rate. `mode` is "raw" or "normalized". */
export function wer(reference, hypothesis, mode = "normalized") {
  const ref = prepare(reference, mode);
  const hyp = prepare(hypothesis, mode);
  return rate(ref ? ref.split(" ") : [], hyp ? hyp.split(" ") : []);
}

/** Character error rate. Spaces are kept: a run-together sentence is an error. */
export function cer(reference, hypothesis, mode = "normalized") {
  return rate([...prepare(reference, mode)], [...prepare(hypothesis, mode)]);
}

/** Both rates, both modes, for one pair. The shape the baseline records. */
export function scoreTranscript(reference, hypothesis) {
  return {
    wer: { raw: wer(reference, hypothesis, "raw").rate, normalized: wer(reference, hypothesis, "normalized").rate },
    cer: { raw: cer(reference, hypothesis, "raw").rate, normalized: cer(reference, hypothesis, "normalized").rate },
    counts: wer(reference, hypothesis, "normalized"),
  };
}

/** Mean of a list of rates, or null when there is nothing to average. */
export function mean(values) {
  const usable = values.filter((value) => typeof value === "number" && Number.isFinite(value));
  if (usable.length === 0) return null;
  return usable.reduce((total, value) => total + value, 0) / usable.length;
}

/**
 * Whether these bytes are plausibly the audio container that was asked for.
 *
 * A magic-byte check, not a decode: it catches a provider returning an error
 * page or an empty body labelled as audio, which is the failure that would
 * otherwise be recorded as a successful synthesis.
 */
export function audioLooksValid(bytes, mimeType) {
  if (!bytes || bytes.length < 4) return { valid: false, reason: "empty" };
  const head = [...bytes.slice(0, 4)];
  const ascii = String.fromCharCode(...head);
  if (ascii === "OggS") return { valid: true, container: "ogg" };
  if (ascii === "RIFF") return { valid: true, container: "wav" };
  if (ascii === "fLaC") return { valid: true, container: "flac" };
  if (ascii.startsWith("ID3")) return { valid: true, container: "mp3" };
  // MPEG frame sync: 0xFF followed by 0xEx or 0xFx.
  if (head[0] === 0xff && (head[1] & 0xe0) === 0xe0) return { valid: true, container: "mp3" };
  return { valid: false, reason: `unrecognised header for ${mimeType}` };
}
