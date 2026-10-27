// One picture that lets a vision model watch a short clip.
//
// ── What was wrong with the first version ───────────────────────────────────
//
// `convert?sheet=` took six frames at equal intervals and tiled them 320 pixels
// wide. Two things follow from that, and neither is a model problem.
//
//  - Equal spacing is blind. A clip of a man talking and then, for two seconds,
//    a screen showing an error code is sampled at 0, 5, 10, 15, 20 and 25
//    seconds, and the error is not in any of them.
//  - 320 pixels is not enough to read anything. A sign, a label or an error
//    message in a clip is the thing the sender usually wants read out.
//
// ── What this does instead ──────────────────────────────────────────────────
//
// It looks for the moments the picture changes (ffmpeg's own scene score, on a
// cheap 160-pixel copy of the clip), keeps the first frame, the last frame and
// the strongest changes, and spends any remaining cells in the biggest gaps so
// a clip with no cuts at all still ends up evenly covered. Nine cells of 448
// pixels, in a 3 × 3 grid, in time order.
//
// The cells are square and letterboxed whatever the clip's shape, because the
// tile layout needs equal cells and a phone clip is as likely to be 9:16 as
// 16:9. The times travel back with the picture so the model is told when each
// frame is, not left to assume they are evenly spaced.
//
// Pure functions only: the tests run them without ffmpeg.

export const SHEET_COLUMNS = 3;
export const SHEET_FRAMES = 9;
export const SHEET_CELL_PX = 448;

/** ffmpeg's scene score runs 0 to 1; around 0.25 is a clear cut or a new screen. */
export const SCENE_THRESHOLD = 0.25;

/** The scan decodes the whole clip, at a size where that is cheap. */
export const SCENE_SCAN_TIMEOUT_MS = 30_000;
/** Pulling nine frames out by seeking is quick. */
export const SHEET_BUILD_TIMEOUT_MS = 40_000;

export function sceneScanArgs(input) {
  return [
    "-nostdin", "-hide_banner", "-loglevel", "error", "-i", input,
    "-an", "-sn",
    "-vf", `scale=160:-2,select='gt(scene,${SCENE_THRESHOLD})',metadata=print:file=-:key=lavfi.scene_score`,
    "-f", "null", "-",
  ];
}

/**
 * The cuts ffmpeg printed, as `{ t, score }`.
 *
 * Each selected frame prints two lines: `frame:N pts:P pts_time:T` and
 * `lavfi.scene_score=S`. Anything else is ignored, and a malformed pair is
 * dropped rather than guessed.
 */
export function parseSceneScan(stdout) {
  const cuts = [];
  let pending = null;
  for (const line of String(stdout ?? "").split("\n")) {
    const time = /pts_time:(-?[0-9.]+)/.exec(line);
    if (time) {
      pending = Number(time[1]);
      continue;
    }
    const score = /lavfi\.scene_score=([0-9.]+)/.exec(line);
    if (score && pending !== null && Number.isFinite(pending) && pending >= 0) {
      const s = Number(score[1]);
      if (Number.isFinite(s)) cuts.push({ t: pending, score: s });
      pending = null;
    }
  }
  return cuts;
}

/** How many frames a clip of this length deserves: no near-duplicates for a two-second clip. */
export function frameCountFor(durationSeconds) {
  if (!(durationSeconds > 0)) return 1;
  return Math.max(2, Math.min(SHEET_FRAMES, Math.round(durationSeconds / 0.5) + 1));
}

/**
 * Seconds at which to take frames, ascending, rounded to a hundredth.
 *
 * The first frame and the last are always in. The strongest cuts follow, never
 * closer together than a sixteenth of the clip, so one flickering moment cannot
 * spend every cell. Whatever is left halves the widest gap, repeatedly.
 */
export function pickFrameTimes(durationSeconds, cuts = []) {
  const d = Number(durationSeconds);
  if (!(d > 0)) return [0];

  const n = frameCountFor(d);
  const start = Math.min(0.3, d * 0.1);
  const end = Math.max(start, d - Math.min(0.5, d * 0.1));
  const chosen = n === 1 ? [start] : [start, end];

  const minGap = d / (SHEET_FRAMES * 4);
  const strongest = [...cuts]
    .filter((c) => Number.isFinite(c.t) && c.t > start && c.t < end)
    .sort((a, b) => b.score - a.score);
  for (const cut of strongest) {
    if (chosen.length >= n) break;
    // A tenth of a second in, so the frame is the new scene and not the dissolve into it.
    const at = Math.min(cut.t + 0.1, end);
    if (chosen.every((t) => Math.abs(t - at) >= minGap)) chosen.push(at);
  }

  while (chosen.length < n) {
    chosen.sort((a, b) => a - b);
    let widest = 0;
    let at = 0;
    for (let i = 1; i < chosen.length; i++) {
      const gap = chosen[i] - chosen[i - 1];
      if (gap > widest) {
        widest = gap;
        at = i;
      }
    }
    if (widest < 0.05) break;
    chosen.push((chosen[at] + chosen[at - 1]) / 2);
  }

  return chosen.sort((a, b) => a - b).map((t) => Math.round(t * 100) / 100);
}

/** `x_y` for each cell, left to right and top to bottom, for ffmpeg's xstack. */
export function sheetLayout(count, columns = SHEET_COLUMNS, cell = SHEET_CELL_PX) {
  const cells = [];
  for (let i = 0; i < count; i++) {
    cells.push(`${(i % columns) * cell}_${Math.floor(i / columns) * cell}`);
  }
  return cells.join("|");
}

/**
 * The ffmpeg command that seeks to each time, scales it into a square cell and
 * tiles the cells into one JPEG. Times are numbers this module produced, never
 * caller text, and they are formatted here.
 */
export function sheetBuildArgs(input, output, times) {
  const cell = SHEET_CELL_PX;
  const args = ["-nostdin", "-hide_banner", "-loglevel", "error", "-y"];
  for (const t of times) args.push("-ss", t.toFixed(2), "-i", input);

  const cells = times.map((_, i) =>
    `[${i}:v]scale=${cell}:${cell}:force_original_aspect_ratio=decrease,` +
    `pad=${cell}:${cell}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1[c${i}]`
  );
  const inputs = times.map((_, i) => `[c${i}]`).join("");
  const stack = times.length === 1
    ? `${inputs}null[sheet]`
    : `${inputs}xstack=inputs=${times.length}:layout=${sheetLayout(times.length)}:fill=black[sheet]`;

  args.push(
    "-filter_complex", [...cells, stack].join(";"),
    "-map", "[sheet]", "-frames:v", "1",
    "-c:v", "mjpeg", "-q:v", "4", "-map_metadata", "-1",
    output,
  );
  return args;
}
