import { describe, expect, it } from "vitest";
import { detectModuleType, getWorkingOutputFormats, requiresServer } from "@/services/file-studio/engine";
import { csvToJson, jsonToCsv } from "@/services/file-studio/modules/developer";
import { BROWSER_OUTPUT_FORMATS as AUDIO_BROWSER } from "@/services/file-studio/modules/audio";
import { BROWSER_OUTPUT_FORMATS as IMAGE_BROWSER } from "@/services/file-studio/modules/images";
import {
  SERVER_VIDEO_OUTPUTS,
  serverCanProduce,
} from "@/services/file-studio/serverConvert";

describe("File Studio format routing", () => {
  it("routes CSV to the developer converter", () => {
    expect(detectModuleType("report.csv")).toBe("developer");
  });

  it("only exposes conversions that are implemented", () => {
    expect(getWorkingOutputFormats("developer", "data.json")).toEqual(["json", "csv", "base64", "hex"]);
    expect(getWorkingOutputFormats("developer", "data.xml")).toEqual(["base64", "hex"]);
    // The two archive formats nothing here reads; the rest are covered by
    // file-studio-archives.test.ts.
    expect(getWorkingOutputFormats("archive", "backup.7z")).toEqual([]);
  });

  // The list used to stop at what a browser can encode, which after the server
  // path shipped meant a visitor with a video was offered nothing at all and a
  // visitor with a WAV could not ask for an MP3. Both are conversions the site
  // performs — the menu was the only thing that disagreed.
  it("offers the formats the server writes, not only the browser's", () => {
    expect(getWorkingOutputFormats("video", "movie.mp4")).toEqual([...SERVER_VIDEO_OUTPUTS]);
    expect(getWorkingOutputFormats("audio", "clip.wav")).toContain("mp3");
    expect(getWorkingOutputFormats("image", "photo.png")).toContain("tiff");
  });

  // The guard that matters is not the shape of any one list: it is that every
  // format the page offers is a format one of the two paths actually produces.
  it("never offers a target neither path can produce", () => {
    const cases = [
      ["audio", "clip.wav", AUDIO_BROWSER],
      ["image", "photo.png", IMAGE_BROWSER],
      ["video", "movie.mp4", []],
    ] as const;
    for (const [moduleType, fileName, browser] of cases) {
      const offered = getWorkingOutputFormats(moduleType, fileName);
      expect(offered.length, moduleType).toBeGreaterThan(0);
      for (const format of offered) {
        expect(
          (browser as readonly string[]).includes(format) || serverCanProduce(format),
          `${moduleType} → ${format}`,
        ).toBe(true);
      }
    }
  });

  // A visitor is told about the account and the 16 MB ceiling before waiting,
  // so the page has to know which conversions leave the tab.
  it("knows which conversions leave the browser", () => {
    expect(requiresServer("audio", "wav")).toBe(false);
    expect(requiresServer("audio", "mp3")).toBe(true);
    expect(requiresServer("image", "png")).toBe(false);
    expect(requiresServer("image", "tiff")).toBe(true);
    expect(requiresServer("video", "mp4")).toBe(true);
    expect(requiresServer("document", "html")).toBe(false);
    expect(requiresServer("developer", "json")).toBe(false);
  });
});

describe("File Studio CSV conversion", () => {
  it("parses quoted commas, escaped quotes, and line breaks", () => {
    expect(csvToJson('name,note\r\n"Ada","hello, world"\r\n"Lin","said ""hi"""')).toEqual([
      { name: "Ada", note: "hello, world" },
      { name: "Lin", note: 'said "hi"' },
    ]);
  });

  it("creates safe CSV cells and preserves keys from later rows", () => {
    const csv = jsonToCsv([{ name: "=cmd" }, { name: "Ada", city: "Beirut" }]);
    expect(csv).toContain('"city"');
    expect(csv).toContain(`"'=cmd"`);
    expect(csv).toContain('"Beirut"');
  });

  it("rejects non-object JSON arrays", () => {
    expect(() => jsonToCsv(["unsafe"])).toThrow("Every JSON array item must be an object");
  });
});
