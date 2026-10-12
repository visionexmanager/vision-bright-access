// Every root-relative asset the app names must exist on disk.
//
// The production server answers a missing file with index.html and a 200, so a
// broken `/favicon.ico` never shows up as an error anywhere: the notification just
// has no icon. This is the only place such a reference can fail loudly.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ASSET = /["'`(](\/[A-Za-z0-9_\-.%/ ]+\.(?:png|jpe?g|webp|svg|gif|mp3|ogg|wav|m4a|mp4|webm|woff2?|ttf|glb|ico|avif))["'`)]/g;

/** Root-relative asset paths named in a piece of source text. */
export function assetReferences(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(ASSET)) {
    const rel = decodeURIComponent(match[1]);
    if (!rel.startsWith("//")) found.push(rel);
  }
  return found;
}

const exists = (rel: string) => existsSync(join("public", rel)) || existsSync(join("src", rel));

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name !== "node_modules" && name !== "test") sourceFiles(path, out);
    } else if (/\.(tsx?|css)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(path);
    }
  }
  return out;
}

describe("local asset references", () => {
  it("finds a reference, and would notice a missing one", () => {
    expect(assetReferences('const a = { icon: "/favicon.ico" }')).toEqual(["/favicon.ico"]);
    expect(assetReferences("url('/audio/ding.mp3')")).toEqual(["/audio/ding.mp3"]);
    expect(assetReferences('const b = "//cdn.example.com/x.png"')).toEqual([]);
    expect(exists("/definitely/not/here.png")).toBe(false);
    expect(exists("/favicon.png")).toBe(true);
  });

  it("every asset the application source names is present in public/ or src/", () => {
    const missing: string[] = [];
    for (const file of [...sourceFiles("src"), "index.html"]) {
      for (const rel of assetReferences(readFileSync(file, "utf8"))) {
        if (!exists(rel)) missing.push(`${rel}  <-  ${file.split("\\").join("/")}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("every icon and shortcut the web manifest names exists", () => {
    const manifest = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8")) as {
      icons?: Array<{ src: string }>;
      shortcuts?: Array<{ icons?: Array<{ src: string }> }>;
    };
    const sources = [
      ...(manifest.icons ?? []).map((i) => i.src),
      ...(manifest.shortcuts ?? []).flatMap((s) => (s.icons ?? []).map((i) => i.src)),
    ];
    expect(sources.length).toBeGreaterThan(0);
    for (const src of sources) expect(exists(src), src).toBe(true);
  });

  it("the notification icon is the favicon that exists, not the one the server fakes with index.html", () => {
    const source = readFileSync("src/hooks/useMessageNotifications.ts", "utf8");
    expect(source).toContain('icon: "/favicon.png"');
    expect(source).not.toContain("favicon.ico");
  });
});

describe("the delivery map", () => {
  const map = readFileSync("src/components/DeliveryMap.tsx", "utf8");

  it("has an accessible name and announces tracking as status, not as decoration", () => {
    expect(map).toMatch(/role="region" aria-label=\{t\("delivery\.liveTracking"\)\}/);
    expect(map).toMatch(/role="status"/);
  });

  it("hides the purely decorative pulse from assistive technology", () => {
    expect(map).toMatch(/animate-ping" aria-hidden="true"/);
  });
});
