// Subtitles, taken apart and put back together with the timings untouched.
//
// ── Why this is its own module and not a regex in a translator ──────────────
//
// A subtitle file is mostly not text. It is a sequence number, a pair of
// timestamps, and then a line or two that somebody actually reads. Hand the
// whole file to a translator and three things happen: the numbers come back
// renumbered, the timestamps come back "translated" — 00:01:23,456 is full of
// digits and a model will happily localise them — and the blank-line structure
// that separates one cue from the next is lost. The result is a file that looks
// right in a diff and will not load in any player.
//
// So the file is parsed into cues, only `text` is ever handed on, and the file
// is rebuilt from the original timings. The timings are copied as *strings*
// rather than parsed into milliseconds and re-formatted: a round trip through a
// number is a chance to lose a millisecond, and a subtitle that drifts is worse
// than one that never moved.
//
// ── SRT and VTT are the same file with two differences ──────────────────────
//
//   - VTT starts with a `WEBVTT` line and SRT does not;
//   - VTT separates seconds from milliseconds with a dot, SRT with a comma.
//
// Everything else — the numbering, the arrow, the blank line between cues — is
// shared, which is why one parser reads both and one serialiser writes either.
// Converting between them is therefore free, and is the conversion people
// actually want: a file that works on a phone and a file that works in a
// browser are these two.

/** One subtitle, with its timing kept exactly as it arrived. */
export interface SubtitleCue {
  /** The sequence number as written, or null where the file had none. */
  index: number | null;
  /** `00:00:01,000` or `00:00:01.000` — the separator the source used. */
  start: string;
  end: string;
  /** Anything after the timestamps on the same line: VTT cue settings. */
  settings: string;
  /** The lines a person reads. The only part anything else may touch. */
  text: string;
}

export type SubtitleFormat = "srt" | "vtt";

export interface ParsedSubtitles {
  format: SubtitleFormat;
  cues: SubtitleCue[];
}

/** How many cues one file may carry. A feature film is around two thousand. */
export const MAX_CUES = 5_000;

/**
 * The timestamp line, in both dialects at once.
 *
 * Hours are optional because plenty of real files omit them, and both `,` and
 * `.` are accepted on either side of the arrow because real files mix them —
 * a strict parser here rejects files that every player opens.
 */
const TIMING = /^\s*(\d{1,3}:)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})\s*-->\s*(\d{1,3}:)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})(.*)$/;

/** Whether a line is the timestamp line of a cue. */
export const isTimingLine = (line: string): boolean => TIMING.test(line);

/**
 * Which dialect this is.
 *
 * The `WEBVTT` header is the only reliable signal — a VTT file is required to
 * start with it — and the separator is the fallback for a file that lost its
 * header somewhere. Neither is a guess: a file with commas and no header is an
 * SRT, and that is what it is treated as.
 */
export function detectSubtitleFormat(source: string): SubtitleFormat {
  if (/^﻿?\s*WEBVTT/.test(source)) return "vtt";
  return "srt";
}

/**
 * Read a subtitle file.
 *
 * Returns an empty cue list for anything that is not one, rather than throwing:
 * the caller is deciding what to do with a file somebody sent, and "this has no
 * subtitles in it" is an answer it can act on.
 */
export function parseSubtitles(source: string): ParsedSubtitles {
  const format = detectSubtitleFormat(source);
  // Every line ending, and the byte-order mark a Windows editor leaves behind.
  const lines = source.replace(/^﻿/, "").split(/\r\n|\r|\n/);

  const cues: SubtitleCue[] = [];
  let pendingIndex: number | null = null;

  for (let i = 0; i < lines.length && cues.length < MAX_CUES; i++) {
    const line = lines[i];

    // A bare number on its own line is a sequence number waiting for its
    // timings. Held rather than emitted: a number with no timing after it is
    // part of the text, not a cue.
    if (/^\s*\d{1,6}\s*$/.test(line)) {
      pendingIndex = Number(line.trim());
      continue;
    }

    const timing = TIMING.exec(line);
    if (!timing) {
      pendingIndex = null;
      continue;
    }

    const [, sh, sm, ss, sms, eh, em, es, ems, settings] = timing;
    const stamp = (h: string | undefined, m: string, s: string, ms: string) =>
      `${(h ?? "00:").replace(":", "").padStart(2, "0")}:${m.padStart(2, "0")}:` +
      `${s.padStart(2, "0")},${ms.padEnd(3, "0")}`;

    // The text is every line up to the next blank one. A cue may be two or
    // three lines and often is; joining them with a space would collapse a
    // deliberate line break that a reader depends on.
    const body: string[] = [];
    let j = i + 1;
    for (; j < lines.length; j++) {
      if (lines[j].trim() === "") break;
      // A file with no blank line between cues is malformed and common. The
      // next timing line ends this cue whether or not a blank line came first.
      if (isTimingLine(lines[j]) || /^\s*\d{1,6}\s*$/.test(lines[j])) {
        // Only if the line after it is a timing line — otherwise a subtitle
        // that is literally the word "12" would end its own cue.
        const next = lines[j + 1] ?? "";
        if (isTimingLine(lines[j]) || isTimingLine(next)) break;
      }
      body.push(lines[j]);
    }

    cues.push({
      index: pendingIndex,
      start: stamp(sh, sm, ss, sms),
      end: stamp(eh, em, es, ems),
      settings: (settings ?? "").trim(),
      text: body.join("\n").trim(),
    });
    pendingIndex = null;
    i = j - 1;
  }

  return { format, cues };
}

/**
 * Write a subtitle file.
 *
 * Renumbered from one, which is the one thing here that does not preserve the
 * source: a file whose numbering had a gap is a file some players stop reading
 * at the gap, and the numbers carry no meaning a viewer sees. Everything a
 * viewer *does* see — the timings, the line breaks, the cue settings — is
 * copied through.
 */
export function serialiseSubtitles(cues: SubtitleCue[], format: SubtitleFormat): string {
  const separator = format === "vtt" ? "." : ",";
  const time = (stamp: string) => stamp.replace(",", separator);

  const blocks = cues.map((cue, position) => {
    const timing = `${time(cue.start)} --> ${time(cue.end)}` +
      (format === "vtt" && cue.settings ? ` ${cue.settings}` : "");
    return `${position + 1}\n${timing}\n${cue.text}`;
  });

  const body = blocks.join("\n\n");
  // The trailing newline is not decoration: a file that ends without one is
  // truncated by some players, which drop the last cue.
  return format === "vtt" ? `WEBVTT\n\n${body}\n` : `${body}\n`;
}

/**
 * Replace the words and nothing else.
 *
 * The whole reason this module exists. `translate` is handed one cue's text at
 * a time and its answer goes back in the same slot; a cue whose translation
 * comes back empty keeps its original, because a subtitle that vanishes is
 * worse than one that was not translated — the viewer loses the line entirely
 * and has no way to know it was ever there.
 */
export async function translateCues(
  cues: readonly SubtitleCue[],
  translate: (text: string) => Promise<string | null>,
): Promise<SubtitleCue[]> {
  const out: SubtitleCue[] = [];
  for (const cue of cues) {
    if (!cue.text) {
      out.push({ ...cue });
      continue;
    }
    const translated = await translate(cue.text);
    out.push({ ...cue, text: translated?.trim() ? translated.trim() : cue.text });
  }
  return out;
}

/** Every word a viewer reads, for detecting what language a file is in. */
export const cueText = (cues: readonly SubtitleCue[]): string =>
  cues.map((cue) => cue.text).filter(Boolean).join("\n");
