// Buttons under a reply: shape, limits, twenty languages, and a typed twin.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const followUps = await import("../../supabase/functions/_shared/whatsappFollowUps.ts");
const commands = await import("../../supabase/functions/_shared/whatsappCommands.ts");
const languages = await import("../../supabase/functions/_shared/whatsappLanguages.ts");
const strings = await import("../../supabase/functions/_shared/whatsappStrings.ts");

const ALL = languages.SUPPORTED_LANGUAGES as readonly string[];
const CONTEXTS = ["answer", "notice", "navigate"] as const;
const BANNED = /\b(choose|select|pick)\b|اختر/i;

describe("follow-up buttons", () => {
  it("covers all twenty languages", () => {
    expect(ALL.length).toBe(20);
  });

  it("every context fits Meta's reply-button limits in every language", () => {
    for (const language of ALL) {
      for (const context of CONTEXTS) {
        const message = followUps.followUpMessage("Done.", context, language);
        expect(message, `${language}/${context}`).not.toBeNull();
        const interactive = message!.tappable.interactive;
        expect(interactive.type).toBe("button");
        const buttons = (interactive as { action: { buttons: { reply: { id: string; title: string } }[] } }).action.buttons;
        expect(buttons.length).toBeGreaterThanOrEqual(2);
        expect(buttons.length).toBeLessThanOrEqual(3);
        for (const { reply } of buttons) {
          expect([...reply.title].length, `${language} ${reply.id}`).toBeLessThanOrEqual(20);
          expect(reply.title.trim()).not.toBe("");
        }
        expect(new Set(buttons.map((b) => b.reply.id)).size).toBe(buttons.length);
      }
    }
  });

  it("every button id resolves to a command, and its title typed resolves to the same one", () => {
    for (const language of ALL) {
      for (const context of CONTEXTS) {
        for (const row of followUps.followUpRows(context, language)) {
          const tapped = commands.parseControlId(row.id);
          expect(tapped, `${language} ${row.id}`).not.toBeNull();
          expect(commands.localisedCommand(row.title, language), `${language} typed ${row.title}`).toBe(tapped);
        }
      }
    }
  });

  it("a reply that fits is the button body, so the buttons sit under the words", () => {
    const message = followUps.followUpMessage("Your order shipped.", "answer", "en")!;
    expect(message.lead).toBeNull();
    expect(message.tappable.text).toBe("Your order shipped.");
    expect((message.tappable.interactive as { body: { text: string } }).body.text).toBe("Your order shipped.");
  });

  it("a long reply goes out whole first, never clipped, then a short line carries the buttons", () => {
    const long = "word ".repeat(400);
    const message = followUps.followUpMessage(long, "answer", "en")!;
    expect(message.lead).toBe(long);
    const body = (message.tappable.interactive as { body: { text: string } }).body.text;
    expect(body).toBe(strings.say("followUpPrompt", "en"));
    expect(body.length).toBeLessThanOrEqual(1024);
  });

  it("only answers and notices get buttons by default; menu prompts and handovers do not", () => {
    expect(followUps.defaultFollowUp("reply")).toBe("answer");
    expect(followUps.defaultFollowUp("unsupported")).toBe("notice");
    expect(followUps.defaultFollowUp("welcome")).toBeNull();
    expect(followUps.defaultFollowUp("handover")).toBeNull();
  });

  it("help after help is not offered", () => {
    const ids = followUps.followUpRows("navigate", "en").map((row: { id: string }) => row.id);
    expect(ids).not.toContain("help");
  });

  it("no new sender-visible string uses the banned words", () => {
    for (const language of ALL) {
      for (const key of ["helpButton", "followUpPrompt"] as const) {
        expect(BANNED.test(strings.say(key, language)), `${language} ${key}`).toBe(false);
      }
    }
  });

  it("the webhook sends written replies through the follow-ups and leaves voice alone", () => {
    const source = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
    expect(source).toContain("followUpMessage(text, context, answerLanguage)");
    // speak() is untouched: a spoken reply never gets buttons.
    expect(source).toMatch(/speak: async \(text\) => \{\s*\/\/ Prerecorded/);
  });
});
