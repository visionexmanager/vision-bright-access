import { describe, expect, it } from "vitest";
import { escapeCsvCell } from "@/lib/library/organizationReports";

describe("organization report CSV cells", () => {
  it("neutralises cells that spreadsheets would run as formulas", () => {
    for (const bad of ["=HYPERLINK(\"http://x\")", "+SUM(A1)", "-2+3", "@cmd", "\t=1", "\r=1"]) {
      const out = escapeCsvCell(bad);
      expect(out.replace(/^"/, "").startsWith("'")).toBe(true);
    }
  });

  it("leaves ordinary text and numbers untouched", () => {
    expect(escapeCsvCell("Ada Lovelace")).toBe("Ada Lovelace");
    expect(escapeCsvCell(-5)).toBe("-5");
    expect(escapeCsvCell("-5.25")).toBe("-5.25");
    expect(escapeCsvCell("12")).toBe("12");
  });

  it("still quotes commas, quotes and line breaks", () => {
    expect(escapeCsvCell("a,b")).toBe('"a,b"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell("a\r\nb")).toBe('"a\r\nb"');
  });
});
