// Nothing a WhatsApp sender reads teaches a digit.
//
// The engine moved off a keypad some time ago — `whatsappStrings.ts` says so,
// and the way back is a button on the message. Two catalogue `intro` strings
// were left behind still saying "Send 0 to go back" / «0» للرجوع, and those are
// the strings shown when somebody opens the assistant, which is the feature
// people use most. Numbers are still *accepted*: a sender who learned "0" two
// months ago should not find it broken. They are simply never taught.

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SHARED = "supabase/functions/_shared";

const whatsappFiles = readdirSync(SHARED)
  .filter((f) => f.startsWith("whatsapp") && f.endsWith(".ts"))
  .map((f) => ({ name: f, src: readFileSync(`${SHARED}/${f}`, "utf8") }));

/** Only what a sender reads — a comment explaining the history is not copy. */
function senderFacing(src: string): string {
  return src
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("//") && !l.trimStart().startsWith("*") && !l.trimStart().startsWith("/*"))
    .join("\n");
}

describe("no WhatsApp copy teaches a number", () => {
  const taught = [
    /Send 0\b/i,
    /press 0\b/i,
    /\b0 to go back/i,
    /reply with a number/i,
    /أرسل 0/,
    /اضغط 0/,
    /«0»/,
    /٠ للرجوع/,
  ];

  for (const { name, src } of whatsappFiles) {
    it(`${name} teaches no digit`, () => {
      const copy = senderFacing(src);
      for (const pattern of taught) {
        expect(copy, `${name} still teaches ${pattern}`).not.toMatch(pattern);
      }
    });
  }
});

describe("but a digit still works, because senders learned it", () => {
  const commands = readFileSync(`${SHARED}/whatsappCommands.ts`, "utf8");

  it("still accepts 0 for Back and 00 for Home", () => {
    expect(commands).toMatch(/BACK_WORDS\s*=\s*\/\^\(0\|/);
    expect(commands).toMatch(/HOME_WORDS\s*=\s*\/\^\(00\|/);
  });

  it("and accepts the words, in both languages", () => {
    for (const word of ["back", "return", "menu", "home", "cancel", "help"]) {
      expect(commands, word).toContain(word);
    }
    for (const word of ["رجوع", "القائمة", "إلغاء", "مساعدة"]) {
      expect(commands, word).toContain(word);
    }
  });
});

describe("Back is a named action, not a keypad key", () => {
  const strings = readFileSync(`${SHARED}/whatsappStrings.ts`, "utf8");

  it("has a translated label for each navigation action", () => {
    expect(strings).toMatch(/back:\s*\{\s*ar:\s*"رجوع",\s*en:\s*"Back"\s*\}/);
  });

  it("names Back in the help text rather than a number", () => {
    expect(strings).toContain("*Back* takes you up one level");
  });
});

describe("the catalogue's assistant entries point at Back", () => {
  const catalog = readFileSync(`${SHARED}/whatsappCatalog.ts`, "utf8");

  it("says Back in English and رجوع in Arabic", () => {
    const intros = catalog.match(/intro:\s*\{[^}]*\}/g) ?? [];
    expect(intros.length).toBeGreaterThan(0);
    const withNav = intros.filter((i) => /Back|رجوع|0/.test(i));
    for (const intro of withNav) {
      expect(intro, "an intro still points at a digit").not.toMatch(/«0»|Send 0|\b0 to go back/);
    }
  });
});
