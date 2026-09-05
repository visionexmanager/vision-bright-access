// A shared pin, answered once, with the next questions attached.
//
// Sharing a location used to produce two messages: where you are, and then the
// weather — sent whether or not anybody wanted the weather. Two messages is two
// notifications and two things to swipe past, and for somebody listening it is
// a forecast read out ahead of the sentence they were waiting for. Anything
// else they might want, they had to know the words for and type.
//
// The interesting property is not that a menu appears. It is that the rows
// carry catalog ids, so a tap arrives as that id *and* as the row's own title
// and lands in exactly the branch a typed "الطقس" already landed in — no new
// route, and therefore nothing new that can rot.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  locationMessage,
  MENU_NOT_DELIVERED,
} from "../../supabase/functions/_shared/whatsappInteractive.ts";
import { type Language, nodeById } from "../../supabase/functions/_shared/whatsappCatalog.ts";
import { SUPPORTED_LANGUAGES } from "../../supabase/functions/_shared/whatsappLanguages.ts";
import { parseWeatherRequest } from "../../supabase/functions/_shared/whatsappWeather.ts";
import { asksWhatIsNearby } from "../../supabase/functions/_shared/whatsappLocation.ts";

const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");

/** The pin branch, from its own guard to the one after it. */
const pinBranch = webhook.slice(
  webhook.indexOf("if (incoming.location) {"),
  webhook.indexOf("if (incoming.media) {"),
);

const PLACE = "📍 *أنت هنا*\nعَمَّان، محافظة عمان، الأردن\n\n31.95390, 35.91060";

const build = (language: Language, disabled: readonly string[] = []) =>
  locationMessage({ language, place: PLACE, title: "عَمَّان", disabled });

/** The row titles and ids, whichever shape Meta's limits produced. */
function choices(language: Language, disabled: readonly string[] = []) {
  const message = build(language, disabled);
  if (!message) return null;
  const { interactive } = message;
  const rows = interactive.type === "button"
    ? interactive.action.buttons.map((b) => ({ id: b.reply.id, title: b.reply.title }))
    : interactive.action.sections[0].rows.map((r) => ({ id: r.id, title: r.title }));
  return { shape: interactive.type, rows, text: message.text };
}

describe("one message, with the choices in it", () => {
  it("offers the two questions a pin makes answerable, and the way out", () => {
    expect(choices("ar")?.rows.map((r) => r.id))
      .toEqual(["services.weather", "services.nearby", "main_menu"]);
  });

  it("does not offer 'where am I' — the message it sits under just answered it", () => {
    expect(choices("ar")?.rows.map((r) => r.id)).not.toContain("services.where");
  });

  it("carries the place itself, so the answer and the choices are one message", () => {
    const message = build("ar");
    expect(message?.interactive.body.text).toContain("عَمَّان");
    expect(message?.interactive.body.text).toContain("31.95390");
  });

  it("fits on buttons in all twenty languages, so choosing is one tap", () => {
    // Three or fewer rows that fit in 20 characters become buttons; anything
    // longer degrades to a list on its own. Both work — this records that today
    // every language gets the better of the two, and will say so if one stops.
    for (const language of SUPPORTED_LANGUAGES) {
      const picked = choices(language);
      expect(picked, language).not.toBeNull();
      expect(picked?.shape, language).toBe("button");
      expect(picked?.rows, language).toHaveLength(3);
      for (const row of picked?.rows ?? []) {
        expect([...row.title].length, `${language}: ${row.title}`).toBeLessThanOrEqual(20);
        expect(row.title.trim(), language).not.toBe("");
      }
    }
  });
});

describe("a tap needs no route of its own", () => {
  it("names rows by ids the catalog actually has", () => {
    for (const row of choices("en")?.rows ?? []) {
      if (row.id === "main_menu") continue;
      expect(nodeById(row.id), row.id).not.toBeNull();
    }
  });

  it("carries a phrase the parsers answer, which is what makes a tap work", () => {
    // This is the whole trick, and it is not the title. A Turkish sender taps
    // *Hava durumu*; the webhook sees the id, finds the node, and hands the
    // node's `phrase` — in Arabic or English, the two languages these parsers
    // read — to the branch that was already there. The forecast then comes back
    // in Turkish. So a row that names a node with no phrase, or a phrase its
    // own parser does not recognise, is a button that does nothing.
    const answered: Record<string, (text: string) => boolean> = {
      "services.weather": (text) => parseWeatherRequest(text) !== null,
      "services.nearby": asksWhatIsNearby,
    };

    for (const row of choices("en")?.rows ?? []) {
      if (row.id === "main_menu") continue;
      const node = nodeById(row.id);
      expect(node?.phrase, row.id).toBeTruthy();
      for (const parserLanguage of ["ar", "en"] as const) {
        const phrase = node?.phrase?.[parserLanguage] ?? "";
        expect(answered[row.id](phrase), `${row.id} / ${parserLanguage}: "${phrase}"`).toBe(true);
      }
    }
  });

  it("is delivered by the branch that substitutes the phrase", () => {
    // The substitution lives in the engine's delegate block and applies to
    // every menu leaf. Losing it would break these two rows silently, and in
    // eighteen languages before anybody noticed in the other two.
    expect(webhook).toContain("questionText = localized(node.phrase, parserLanguage)");
  });
});

describe("a flag still switches a feature off", () => {
  it("drops a follow-up that is disabled", () => {
    expect(choices("ar", ["services.weather"])?.rows.map((r) => r.id))
      .toEqual(["services.nearby", "main_menu"]);
  });

  it("offers nothing at all rather than an empty list", () => {
    // The caller sends the place as ordinary text instead. A message with an
    // empty list under it is not an improvement on that.
    expect(build("ar", ["services.weather", "services.nearby"])).toBeNull();
    expect(pinBranch).toContain("if (choices) {");
  });
});

describe("what a sender hears rather than sees", () => {
  it("says the same thing in words, for voice and for a refused interactive", () => {
    const text = choices("ar")?.text ?? "";
    expect(text).toContain("عَمَّان");
    for (const row of choices("ar")?.rows ?? []) expect(text).toContain(row.title);
  });
});

describe("the webhook sends it once", () => {
  it("no longer posts the forecast nobody asked for", () => {
    expect(pinBranch).not.toContain("formatWeather(");
    expect(pinBranch).not.toContain("fetchWeather(");
  });

  it("still keeps the pin, so the weather is answerable when it is asked for", () => {
    expect(pinBranch).toContain("last_latitude");
  });

  it("delivers through the one policy that records and speaks", () => {
    // `sendChoices` is where the transcript row, the medium and the
    // spoken-send correction live. A second copy of those would be a second
    // delivery-medium policy.
    expect(pinBranch).toContain("sendChoices(choices,");
    expect(webhook).toContain("await sendChoices(message, \"welcome\")");
  });

  it("reports an undelivered menu rather than inventing a medium", () => {
    expect(MENU_NOT_DELIVERED.sent).toBe(false);
    expect(MENU_NOT_DELIVERED.spokenFailed).toBe(false);
  });
});
