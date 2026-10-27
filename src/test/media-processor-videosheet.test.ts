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
  SHEET_CELL_PX,
  SHEET_COLUMNS,
  SHEET_FRAMES,
  frameCountFor,
  parseSceneScan,
  pickFrameTimes,
  sceneScanArgs,
  sheetBuildArgs,
  sheetLayout,
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
  it("lays cells out left to right and top to bottom", () => {
    expect(sheetLayout(5)).toBe("0_0|448_0|896_0|0_448|448_448");
    expect(SHEET_COLUMNS).toBe(3);
    expect(SHEET_CELL_PX).toBe(448);
  });

  it("seeks once per time and passes only numbers the module produced", () => {
    const args = sheetBuildArgs("/tmp/in", "/tmp/out.jpg", [0.3, 6.1, 14.1]);
    const seeks = args.flatMap((a, i) => (a === "-ss" ? [args[i + 1]] : []));
    expect(seeks).toEqual(["0.30", "6.10", "14.10"]);
    expect(args.filter((a) => a === "-i")).toHaveLength(3);
    const graph = args[args.indexOf("-filter_complex") + 1];
    expect(graph).toContain("xstack=inputs=3:layout=0_0|448_0|896_0");
    expect(args.slice(-1)).toEqual(["/tmp/out.jpg"]);
    expect(args).toContain("-map_metadata");
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
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
