import { describe, expect, it } from "vitest";
import { detectModuleType, getWorkingOutputFormats } from "@/services/file-studio/engine";
import { csvToJson, jsonToCsv } from "@/services/file-studio/modules/developer";

describe("File Studio format routing", () => {
  it("routes CSV to the developer converter", () => {
    expect(detectModuleType("report.csv")).toBe("developer");
  });

  it("only exposes conversions that are implemented", () => {
    expect(getWorkingOutputFormats("developer", "data.json")).toEqual(["json", "csv", "base64", "hex"]);
    expect(getWorkingOutputFormats("developer", "data.xml")).toEqual(["base64", "hex"]);
    expect(getWorkingOutputFormats("video", "movie.mp4")).toEqual([]);
    expect(getWorkingOutputFormats("image", "photo.png")).toEqual(["jpg", "jpeg", "png", "webp"]);
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
