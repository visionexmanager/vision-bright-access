// Choosing the frames of a clip.
//
// The property under test is the reason this exists: a short scene that equal
// spacing steps over has to be in the sheet. The pure functions are tested
// directly; one test runs the real ffmpeg commands and is skipped where there
// is no ffmpeg (CI runners and some desktops), like the conversion tests.

import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  SHEET_COLUMNS,
  SHEET_FRAMES,
  SHEET_SHAPES,
  frameCountFor,
  parseSceneScan,
  pickFrameTimes,
  sceneScanArgs,
  sheetBuildArgs,
  sheetLayout,
  sheetShape,
} from "../../services/media-processor/src/videosheet.mjs";

const scan = (pairs: Array<[number, number]>) =>
  pairs.map(([t, s]) => `frame:0    pts:${Math.round(t * 1000)}    pts_time:${t}\nlavfi.scene_score=${s}`).join("\n");

describe("parseSceneScan", () => {
  it("reads each time with its score and ignores everything else", () => {
    const out = "noise\n" + scan([[6, 0.575], [14, 1]]) + "\nmore noise";
    expect(parseSceneScan(out)).toEqual([{ t: 6, score: 0.575 }, { t: 14, score: 1 }]);
  });

  it("drops a score with no time, a negative time and non-numbers", () => {
    expect(parseSceneScan("lavfi.scene_score=0.9")).toEqual([]);
    expect(parseSceneScan("frame:0 pts:1 pts_time:-3\nlavfi.scene_score=0.9")).toEqual([]);
    expect(parseSceneScan(undefined)).toEqual([]);
    expect(parseSceneScan("")).toEqual([]);
  });
});

describe("frameCountFor", () => {
  it("gives a short clip fewer frames, never more than a sheet, never fewer than two", () => {
    expect(frameCountFor(1)).toBe(3);
    expect(frameCountFor(2)).toBe(5);
    expect(frameCountFor(0.2)).toBe(2);
    expect(frameCountFor(20)).toBe(SHEET_FRAMES);
    expect(frameCountFor(3600)).toBe(SHEET_FRAMES);
  });

  it("copes with an unknown length", () => {
    expect(frameCountFor(0)).toBe(1);
    expect(frameCountFor(NaN)).toBe(1);
  });
});

describe("pickFrameTimes", () => {
  const sorted = (a: number[]) => a.every((v, i) => i === 0 || v > a[i - 1]);

  it("a clip with no cuts is covered evenly, first frame to last", () => {
    const t = pickFrameTimes(20, []);
    expect(t).toHaveLength(SHEET_FRAMES);
    expect(t[0]).toBe(0.3);
    expect(t.at(-1)).toBe(19.5);
    expect(sorted(t)).toBe(true);
    const gaps = t.slice(1).map((v, i) => v - t[i]);
    expect(Math.max(...gaps) / Math.min(...gaps)).toBeLessThan(2.1);
  });

  it("puts a frame in a two-second scene that six equal intervals step over", () => {
    // Blue from 15 to 17 seconds in a 20-second clip. Equal spacing of six
    // frames lands on 0, 3.3, 6.7, 10, 13.3 and 16.7: only the last is close.
    const cuts = [{ t: 6, score: 0.57 }, { t: 14, score: 1 }, { t: 15, score: 1 }, { t: 17, score: 0.9 }];
    const t = pickFrameTimes(20, cuts);
    expect(t.some((v) => v >= 15 && v < 17)).toBe(true);
    expect(t.some((v) => v >= 14 && v < 15)).toBe(true);
  });

  it("samples just inside the new scene, not on the cut", () => {
    const t = pickFrameTimes(20, [{ t: 10, score: 0.9 }]);
    expect(t).toContain(10.1);
    expect(t).not.toContain(10);
  });

  it("lets the strongest changes win when there are more cuts than cells", () => {
    const cuts = Array.from({ length: 40 }, (_, i) => ({ t: 1 + i * 0.45, score: i === 17 ? 1 : 0.3 }));
    const t = pickFrameTimes(20, cuts);
    expect(t).toHaveLength(SHEET_FRAMES);
    expect(t.some((v) => Math.abs(v - (1 + 17 * 0.45 + 0.1)) < 0.011)).toBe(true);
  });

  it("does not spend two cells on one flicker", () => {
    const t = pickFrameTimes(20, [{ t: 8, score: 0.9 }, { t: 8.1, score: 0.95 }, { t: 8.2, score: 0.9 }]);
    expect(t.filter((v) => v > 7.9 && v < 8.6).length).toBeLessThanOrEqual(2);
    expect(sorted(t)).toBe(true);
  });

  it("ignores cuts outside the clip's usable span and non-finite times", () => {
    const t = pickFrameTimes(10, [{ t: -1, score: 1 }, { t: 99, score: 1 }, { t: NaN, score: 1 }]);
    expect(t.every((v) => v >= 0 && v <= 10)).toBe(true);
    expect(t).toHaveLength(SHEET_FRAMES);
  });

  it("handles a clip too short to cut and an unknown duration", () => {
    expect(pickFrameTimes(0.4, [])).toHaveLength(2);
    expect(pickFrameTimes(0, [])).toEqual([0]);
    expect(pickFrameTimes(NaN, [])).toEqual([0]);
  });
});

describe("the ffmpeg arguments", () => {
  it("lays cells out left to right and top to bottom, to the clip's shape", () => {
    expect(sheetLayout(5)).toBe("0_0|448_0|896_0|0_252|448_252");
    expect(sheetLayout(5, "landscape")).toBe("0_0|448_0|896_0|0_252|448_252");
    expect(sheetLayout(5, "portrait")).toBe("0_0|252_0|504_0|0_448|252_448");
    expect(sheetLayout(4, "square")).toBe("0_0|336_0|672_0|0_336");
    expect(SHEET_COLUMNS).toBe(3);
  });

  it("keeps every sheet's short side near 768, where vision models stop shrinking it", () => {
    for (const { cellW, cellH } of Object.values(SHEET_SHAPES) as Array<{ cellW: number; cellH: number }>) {
      const w = SHEET_COLUMNS * cellW;
      const h = Math.ceil(SHEET_FRAMES / SHEET_COLUMNS) * cellH;
      expect(Math.min(w, h)).toBeLessThanOrEqual(1008);
      expect(Math.min(w, h)).toBeGreaterThanOrEqual(756);
      expect(cellW % 2).toBe(0);
      expect(cellH % 2).toBe(0);
    }
  });

  it("chooses the shape from the clip's dimensions", () => {
    expect(sheetShape(1920, 1080)).toBe("landscape");
    expect(sheetShape(720, 1280)).toBe("portrait");
    expect(sheetShape(1080, 1080)).toBe("square");
    expect(sheetShape(1440, 1080)).toBe("landscape"); // 4:3
    expect(sheetShape(null, null)).toBe("landscape");
    expect(sheetShape(undefined, 0)).toBe("landscape");
    expect(sheetShape(0, 100)).toBe("landscape");
  });

  it("seeks once per time and passes only numbers the module produced", () => {
    const args = sheetBuildArgs("/tmp/in", "/tmp/out.jpg", [0.3, 6.1, 14.1]);
    const seeks = args.flatMap((a, i) => (a === "-ss" ? [args[i + 1]] : []));
    expect(seeks).toEqual(["0.30", "6.10", "14.10"]);
    expect(args.filter((a) => a === "-i")).toHaveLength(3);
    const graph = args[args.indexOf("-filter_complex") + 1];
    expect(graph).toContain("xstack=inputs=3:layout=0_0|448_0|896_0");
    expect(graph).toContain("scale=448:252:force_original_aspect_ratio=decrease");
    expect(args.slice(-1)).toEqual(["/tmp/out.jpg"]);
    expect(args).toContain("-map_metadata");
  });

  it("cuts portrait cells for a portrait clip", () => {
    const graph = sheetBuildArgs("/tmp/in", "/tmp/out.jpg", [0.3, 6.1], "portrait").join(" ");
    expect(graph).toContain("scale=252:448:force_original_aspect_ratio=decrease");
    expect(graph).toContain("layout=0_0|252_0");
  });

  it("falls back to landscape for a shape it does not know", () => {
    const graph = sheetBuildArgs("/tmp/in", "/tmp/out.jpg", [0.3, 6.1], "../../etc").join(" ");
    expect(graph).toContain("scale=448:252");
  });

  it("builds a single frame without a stack", () => {
    const graph = sheetBuildArgs("/tmp/in", "/tmp/out.jpg", [0]).join(" ");
    expect(graph).toContain("null[sheet]");
    expect(graph).not.toContain("xstack");
  });

  it("scans a small copy of the clip and prints scores to stdout", () => {
    const args = sceneScanArgs("/tmp/in").join(" ");
    expect(args).toContain("scale=160:-2");
    expect(args).toContain("metadata=print:file=-");
    // Five frames a second keep the printed list small enough for the service's 64 KB.
    expect(args).toContain("fps=5");
    expect(args).toContain("gt(scene,0.15)");
  });
});

describe("weak scene changes", () => {
  it("are taken where the chosen frames leave a wide gap, as in a 3.6 s scene change that scores 0.2", () => {
    // A 10.4 s clip with a weak cut at 7.2: the first, the last and a strong cut
    // at 3.6 leave 3.6 s on each side, so the weak cut is far from every frame.
    const t = pickFrameTimes(10.4, [{ t: 3.6, score: 0.28 }, { t: 7.2, score: 0.2 }]);
    expect(t.some((v) => Math.abs(v - 7.3) < 0.011)).toBe(true);
  });

  it("do not displace even coverage when they are close to frames already chosen", () => {
    const noise = Array.from({ length: 60 }, (_, i) => ({ t: 0.5 + i * 0.3, score: 0.16 }));
    const t = pickFrameTimes(20, noise);
    expect(t).toHaveLength(SHEET_FRAMES);
    const gaps = t.slice(1).map((v, i) => v - t[i]);
    // Camera shake everywhere must still leave the clip covered without a hole.
    expect(Math.max(...gaps)).toBeLessThan(20 / SHEET_FRAMES * 2);
  });

  it("let a strong cut win over a weak one at the same place", () => {
    const t = pickFrameTimes(20, [{ t: 10, score: 0.17 }, { t: 10.2, score: 0.9 }]);
    expect(t).toContain(10.3);
    expect(t).not.toContain(10.1);
  });
});

const ffmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;

describe.skipIf(!ffmpeg)("with the real ffmpeg", () => {
  it("finds the cuts in a synthetic clip and builds a sheet with a frame from the short blue scene", () => {
    const dir = mkdtempSync(join(tmpdir(), "vsheet-"));
    try {
      const clip = join(dir, "clip.mp4");
      const make = spawnSync("ffmpeg", [
        "-v", "error", "-y",
        "-f", "lavfi", "-i", "color=c=red:s=320x180:d=6:r=25",
        "-f", "lavfi", "-i", "testsrc2=s=320x180:d=8:r=25",
        "-f", "lavfi", "-i", "color=c=white:s=320x180:d=1:r=25",
        "-f", "lavfi", "-i", "color=c=blue:s=320x180:d=2:r=25",
        "-f", "lavfi", "-i", "testsrc=s=320x180:d=3:r=25",
        "-filter_complex", "[0:v][1:v][2:v][3:v][4:v]concat=n=5:v=1:a=0,format=yuv420p[v]",
        "-map", "[v]", "-c:v", "mpeg4", clip,
      ]);
      expect(make.status).toBe(0);

      const scanned = spawnSync("ffmpeg", sceneScanArgs(clip), { encoding: "utf8" });
      expect(scanned.status).toBe(0);
      const cuts = parseSceneScan(scanned.stdout);
      expect(cuts.some((c) => Math.abs(c.t - 15) < 0.2)).toBe(true);

      const times = pickFrameTimes(20, cuts);
      expect(times.some((t) => t >= 15 && t < 17)).toBe(true);

      const out = join(dir, "sheet.jpg");
      const built = spawnSync("ffmpeg", sheetBuildArgs(clip, out, times), { encoding: "utf8" });
      expect(built.status).toBe(0);
      expect(statSync(out).size).toBeGreaterThan(1000);
      // A JPEG: starts with the SOI marker.
      expect([...readFileSync(out).subarray(0, 2)]).toEqual([0xff, 0xd8]);
      // A 16:9 clip gets 16:9 cells: 3 x 3 of 448 x 252.
      const size = spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=width,height", "-of", "csv=p=0", out], { encoding: "utf8" });
      expect(size.stdout.trim()).toBe("1344,756");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds a portrait sheet with no wasted bars for a portrait clip", () => {
    const dir = mkdtempSync(join(tmpdir(), "vsheet-p-"));
    try {
      const clip = join(dir, "clip.mp4");
      const make = spawnSync("ffmpeg", [
        "-v", "error", "-y",
        "-f", "lavfi", "-i", "color=c=red:s=360x640:d=4:r=25",
        "-f", "lavfi", "-i", "testsrc2=s=360x640:d=4:r=25",
        "-filter_complex", "[0:v][1:v]concat=n=2:v=1:a=0,format=yuv420p[v]",
        "-map", "[v]", "-c:v", "mpeg4", clip,
      ]);
      expect(make.status).toBe(0);
      const out = join(dir, "sheet.jpg");
      const built = spawnSync("ffmpeg", sheetBuildArgs(clip, out, pickFrameTimes(8, []), sheetShape(360, 640)), { encoding: "utf8" });
      expect(built.status).toBe(0);
      const size = spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=width,height", "-of", "csv=p=0", out], { encoding: "utf8" });
      expect(size.stdout.trim()).toBe("756,1344");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
