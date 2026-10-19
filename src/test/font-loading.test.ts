import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// A CSS @import is discovered only after the stylesheet that contains it has been
// downloaded, which puts the font stylesheet one round trip behind the app CSS on
// the render-blocking path. The fonts are linked from index.html instead.
const html = readFileSync("index.html", "utf8");
const css = readFileSync("src/index.css", "utf8");

describe("web font loading", () => {
  it("does not @import a remote stylesheet from the app CSS", () => {
    expect(css).not.toMatch(/@import\s+url\(\s*['"]?https?:/i);
  });

  it("links the font stylesheet from index.html with display=swap and every family the CSS relies on", () => {
    const link = html.match(/<link[^>]+rel="stylesheet"[^>]+href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)"/)?.[1];
    expect(link).toBeDefined();
    const url = link!.replace(/&amp;/g, "&");
    expect(url).toContain("display=swap");
    for (const family of ["Space+Grotesk", "Inter", "Cairo", "Noto+Sans+Devanagari"]) {
      expect(url).toContain(`family=${family}`);
    }
  });

  it("opens both font connections early", () => {
    expect(html).toMatch(/<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com"/);
    expect(html).toMatch(/<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin/);
  });
});
