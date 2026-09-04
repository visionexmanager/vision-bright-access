import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import { pngSize, squarePng, squarePngProblem } from "../../scripts/lib/square-png.mjs";
import { normalise } from "../../scripts/whatsapp-profile.mjs";

// The WhatsApp business profile is the company information every customer sees
// when they tap the business name: the about line, the description, the support
// address, the websites, the industry. It is published from
// `supabase/functions/_shared/business-profile.json` by
// `scripts/whatsapp-profile.mjs`.
//
// Two different things are checked here. First that the file is publishable at
// all — Meta rejects an over-length field with an error that names neither the
// field nor the limit, and the round trip to find that out is a manual workflow
// run. Second that the profile and the assistant tell a customer the same
// story: the profile is written once and forgotten, the prompt is edited often,
// and nothing else would notice the day they start disagreeing about how to
// reach the company.

const PROFILE_PATH = "supabase/functions/_shared/business-profile.json";

const profile = JSON.parse(readFileSync(PROFILE_PATH, "utf8"));
const assistants = readFileSync("supabase/functions/_shared/assistants.ts", "utf8");
const englishCopy = readFileSync("src/i18n/en.ts", "utf8");

// The WhatsApp assistant is the last entry in the registry, so everything from
// its key onwards is its prompt. Slicing keeps the assertions off the other
// assistants, several of which quote a different Visionex address.
const whatsappPrompt = assistants.slice(assistants.indexOf('"whatsapp-support": assistant('));

/**
 * Pull the image data out of a PNG, so the padding can be checked on the
 * scanlines rather than only on the header it also writes.
 *
 * Walking the chunks here rather than reusing the helper's own parser is
 * deliberate: a test that reads the bytes back with the same code that wrote
 * them would pass on a shared misunderstanding of the format.
 */
function idatOf(png: Buffer): Buffer {
  const parts: Buffer[] = [];
  let offset = 8;
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString("ascii");
    if (type === "IDAT") parts.push(png.subarray(offset + 8, offset + 8 + length));
    if (type === "IEND") break;
    offset += 12 + length;
  }
  return Buffer.concat(parts);
}

describe("WhatsApp business profile", () => {
  // Spawns a second Node process, so it costs a couple of seconds even when it
  // passes. That fits the five-second default when this file runs alone and not
  // when the whole suite runs in parallel — the same intermittent failure the
  // Sudoku endings test had.
  it("passes the validator the publish workflow runs before it writes", { timeout: 30000 }, () => {
    // Delegating to the script rather than restating its limits is the point:
    // the workflow refuses to publish on exactly this exit code, so a green
    // test here means the publish step will clear its own gate.
    const output = execFileSync(
      process.execPath,
      ["scripts/whatsapp-profile.mjs", "--validate"],
      { encoding: "utf8" },
    );
    expect(output).toContain("is valid");
  });

  it("carries no credential", () => {
    // The file is public company information and is read by a workflow that
    // holds a System User token. Neither belongs in the other.
    const raw = readFileSync(PROFILE_PATH, "utf8");
    expect(raw).not.toMatch(/EAA[A-Za-z0-9]{20,}/);
    expect(Object.keys(profile)).not.toContain("token");
  });

  it("gives the same support address the assistant gives", () => {
    expect(profile.email).toBe("support@visionex.app");
    expect(whatsappPrompt).toContain(profile.email);
  });

  it("states the same support hours as the website", () => {
    // The Contact page is where this claim was made first. If marketing
    // changes it there, the profile and the assistant are now two more places
    // saying something the company no longer promises.
    const hours = englishCopy.match(/"contact\.supportHours":\s*"([^"]+)"/)?.[1];
    expect(hours).toBeTruthy();
    expect(profile.description).toContain(hours);
    expect(whatsappPrompt).toContain(hours);
  });

  it("promises the same response time everywhere", () => {
    const responseTime = englishCopy.match(/"contact\.responseTime":\s*"([^"]+)"/)?.[1];
    expect(responseTime).toBeTruthy();
    // Compared on the duration alone: the page says "Within 24 hours" as a
    // label, the profile and the prompt say it inside a sentence, and only the
    // number is the promise.
    const duration = responseTime!.replace(/^within\s+/i, "").toLowerCase();
    expect(profile.description.toLowerCase()).toContain(duration);
    expect(whatsappPrompt.toLowerCase()).toContain(duration);
  });

  it("advertises only visionex.app, over https", () => {
    expect(profile.websites.length).toBeGreaterThan(0);
    for (const site of profile.websites) {
      expect(site).toMatch(/^https:\/\/visionex\.app(\/|$)/);
    }
  });

  it("claims no office, and the assistant says so rather than inventing one", () => {
    // Meta prints `address` on the profile as a place of business. Visionex has
    // none to print, and a model asked "where are you based?" will happily
    // supply one, so the prompt is told the answer explicitly.
    expect(profile.address).toBe("");
    expect(whatsappPrompt).toContain("no walk-in address");
  });

  it("is answered in both languages the assistant supports", () => {
    // The welcome message and the assistant both work in Arabic and English.
    // A profile only in English is the one surface that would not.
    expect(profile.description).toMatch(/[؀-ۿ]/);
    expect(profile.description).toMatch(/[A-Za-z]/);
  });
});

describe("comparing the file against what Meta stores", () => {
  it("treats a canonicalised URL as the same URL", () => {
    // Meta stored `https://visionex.app` as `https://visionex.app/` on the
    // first publish, which a string comparison called drift on every run
    // afterwards — drift no edit could settle, because writing the trailing
    // slash into the file just moves the guess to Meta's next rule.
    expect(normalise("websites", ["https://visionex.app"]))
      .toBe(normalise("websites", ["https://visionex.app/"]));

    // The two configured websites, compared against the forms Meta actually
    // returned on the first publish.
    expect(normalise("websites", profile.websites))
      .toBe(normalise("websites", ["https://visionex.app/", "https://visionex.app/contact"]));
  });

  it("still reports a URL that genuinely differs", () => {
    expect(normalise("websites", ["https://visionex.app"]))
      .not.toBe(normalise("websites", ["https://visionex.app/contact"]));
    expect(normalise("websites", ["https://visionex.app"]))
      .not.toBe(normalise("websites", ["https://example.com/"]));
  });

  it("compares every other field exactly", () => {
    // Only URLs get canonicalised. A description that differs by a space is a
    // description someone changed in the console.
    expect(normalise("description", "a b")).not.toBe(normalise("description", "a  b"));
    expect(normalise("about", undefined)).toBe("");
  });
});

describe("the profile picture", () => {
  it("is the logo the website itself serves", () => {
    // Not a copy of the logo — the same file the browser tab shows. A second
    // copy is a second thing to update, and the WhatsApp profile is precisely
    // the surface nobody would think to update.
    expect(profile.profile_picture).toBe("public/favicon.png");
    expect(readFileSync("index.html", "utf8")).toContain('href="/favicon.png"');
  });

  it("is a format the padding can handle", () => {
    // The padding works on the compressed scanline stream and relies on a zero
    // byte meaning black, which is true of 8-bit RGB and of nothing else. If
    // someone re-exports the logo with an alpha channel this fails here rather
    // than producing a transparent smear on the live profile.
    const png = readFileSync(profile.profile_picture);
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(png[24]).toBe(8); // bit depth
    expect(png[25]).toBe(2); // colour type: truecolour, no alpha
    expect(png[28]).toBe(0); // not interlaced
    expect(squarePngProblem(png)).toBeNull();
  });

  it("pads to a square that still contains every original row", () => {
    const source = readFileSync(profile.profile_picture);
    const padded = squarePng(source);

    const before = pngSize(source);
    const after = pngSize(padded);
    expect(after.width).toBe(before.width);
    expect(after.height).toBe(after.width);
    expect(before.height).toBeLessThan(before.width);

    // Meta's floor, and its ceiling.
    expect(after.width).toBeGreaterThanOrEqual(192);
    expect(padded.length).toBeLessThan(5 * 1024 * 1024);

    // Every row of the source survives, and the added rows are black: the
    // inflated stream is exactly one filter byte plus one RGB triple per pixel
    // per row, and the bars at top and bottom are all zeros.
    const stride = after.width * 3 + 1;
    const raw = inflateSync(idatOf(padded));
    expect(raw.length).toBe(after.height * stride);

    const bar = (after.height - before.height) / 2;
    expect(raw.subarray(0, bar * stride).every((byte) => byte === 0)).toBe(true);
    expect(raw.subarray((bar + before.height) * stride).every((byte) => byte === 0)).toBe(true);
    // The original band is not blank — the artwork is still in there.
    expect(raw.subarray(bar * stride, (bar + before.height) * stride).some((b) => b !== 0)).toBe(true);
  });

  it("refuses an image whose zero byte would not mean black", () => {
    // Colour type 6 is RGBA, where a zero row is transparent rather than
    // black. Flipping the header byte is enough to prove the guard reads it.
    const rgba = Buffer.from(readFileSync(profile.profile_picture));
    rgba[25] = 6;
    expect(squarePngProblem(rgba)).toMatch(/8-bit truecolour/);
    expect(() => squarePng(rgba)).toThrow(/8-bit truecolour/);
  });
});
