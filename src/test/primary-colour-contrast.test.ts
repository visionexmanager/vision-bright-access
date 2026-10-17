import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Found by running axe-core on production: the teal primary was 4.38:1 on white
// and 4.11:1 on the light section background, below WCAG AA (4.5:1) for text.

const css = readFileSync("src/index.css", "utf8");
const lightRoot = css.slice(css.indexOf(":root {"), css.indexOf(".dark {"));

function token(name: string): [number, number, number] {
  const m = new RegExp(String.raw`--${name}:\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%`).exec(lightRoot);
  if (!m) throw new Error(`--${name} not found`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function hslToRgb([h, s, l]: [number, number, number]): number[] {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((x) => Math.round(x * 255));
}

function luminance(rgb: number[]): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: number[], b: number[]): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

describe("light-theme primary colour", () => {
  const primary = hslToRgb(token("primary"));

  it("meets WCAG AA for text on white and on the light section backgrounds", () => {
    for (const bg of [[255, 255, 255], [249, 250, 251], [246, 248, 249], [231, 242, 241]]) {
      expect(ratio(primary, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps white text on the primary button AA", () => {
    expect(ratio(primary, hslToRgb(token("primary-foreground")))).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps muted text (footer headings) AA on white", () => {
    expect(ratio(hslToRgb(token("muted-foreground")), [255, 255, 255])).toBeGreaterThanOrEqual(4.5);
  });
});
