import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  onboardingYieldsTo,
  runOnboarding,
  type OnboardingMessage,
  type OnboardingState,
} from "../../supabase/functions/_shared/whatsappOnboarding";
import { asksForMenu } from "../../supabase/functions/_shared/whatsappVisionModes";

// The owner's rule for this channel: every message gets an answer, the way a
// general assistant answers — not a setup question, not a list of features.
// These pin the two places a real question used to be turned away before the
// assistant ever saw it.

const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
const NOW = Date.parse("2026-09-15T10:00:00Z");

function outcomeFor(state: OnboardingState, message: OnboardingMessage) {
  return runOnboarding(message, { state, language: "en", phone: "96170000000", nowMs: NOW });
}

describe("a new sender's question is answered, not met with the setup", () => {
  it("lets a typed question through at the very first message", () => {
    for (const text of ["hi", "what is paracetamol?", "مرحبا", "شو هي عاصمة فرنسا", "Explain black holes simply"]) {
      const message: OnboardingMessage = { text, kind: "text" };
      expect(onboardingYieldsTo(message, outcomeFor("language_selection", message)), text).toBe(true);
    }
  });

  it("lets a voice note, a photo or a document through, at any step", () => {
    for (const kind of ["audio", "image", "document", "location"] as const) {
      for (const state of ["language_selection", "profile_name", "profile_email"] as OnboardingState[]) {
        const message: OnboardingMessage = { text: "", kind };
        expect(onboardingYieldsTo(message, outcomeFor(state, message)), `${kind} at ${state}`).toBe(true);
      }
    }
  });

  it("lets a question through part-way, where it answers nothing", () => {
    const message: OnboardingMessage = { text: "how do I cook rice?", kind: "text" };
    expect(onboardingYieldsTo(message, outcomeFor("profile_email", message))).toBe(true);
    const date: OnboardingMessage = { text: "what's the weather tomorrow", kind: "text" };
    expect(onboardingYieldsTo(date, outcomeFor("profile_birth_date", date))).toBe(true);
  });

  it("still runs the setup for anybody who uses it", () => {
    // A tapped language, a tapped Back, a valid email: all setup.
    const tappedLanguage: OnboardingMessage = { text: "", kind: "interactive", selection: "language.ar" };
    const chosen = outcomeFor("language_selection", tappedLanguage);
    expect(chosen.reason).toBe("language_set");
    expect(onboardingYieldsTo(tappedLanguage, chosen)).toBe(false);
    const back: OnboardingMessage = { text: "back", kind: "text" };
    expect(onboardingYieldsTo(back, outcomeFor("profile_email", back))).toBe(false);
    const email: OnboardingMessage = { text: "amal@example.com", kind: "text" };
    const saved = outcomeFor("profile_email", email);
    expect(saved.reason).toBe("field_saved");
    expect(onboardingYieldsTo(email, saved)).toBe(false);
    // An empty message is not a question.
    const empty: OnboardingMessage = { text: "   ", kind: "text" };
    expect(onboardingYieldsTo(empty, outcomeFor("language_selection", empty))).toBe(false);
  });

  it("stores nothing from the message it lets through", () => {
    const message: OnboardingMessage = { text: "what is paracetamol?", kind: "text" };
    for (const state of ["language_selection", "profile_birth_date", "profile_email"] as OnboardingState[]) {
      const outcome = outcomeFor(state, message);
      if (onboardingYieldsTo(message, outcome)) expect(outcome.columns, state).toEqual({});
    }
  });

  it("is wired into the gate: marked complete, then answered rather than re-asked", () => {
    const gate = webhook.slice(webhook.indexOf("if (isOnboarding(onboardingState))"), webhook.indexOf("── Changing the language afterwards"));
    expect(gate).toContain("if (onboardingYieldsTo(onboardingMessage, outcome))");
    expect(gate).toContain('.update({ onboarding_status: "complete" })');
    // The re-ask and its `continue` sit only on the other branch.
    const yieldAt = gate.indexOf("if (onboardingYieldsTo(onboardingMessage, outcome))");
    const elseAt = gate.indexOf("} else {", yieldAt);
    const continueAt = gate.indexOf("continue;", yieldAt);
    expect(elseAt).toBeGreaterThan(yieldAt);
    expect(continueAt).toBeGreaterThan(elseAt);
    expect(gate.slice(yieldAt, elseAt)).not.toContain("continue;");
  });
});

describe("the menu is shown when it is asked for, and not when a question mentions help", () => {
  it("still opens on the request itself", () => {
    for (const text of ["menu", "Menu", "help", "what can you do", "what can you do?", "show me the menu", "options",
      "القائمة", "قائمة", "مساعدة", "بدي القائمة", "شو بتقدر تعمل", "شو بتقدر تعمل؟"]) {
      expect(asksForMenu(text), text).toBe(true);
    }
  });

  it("answers a question that only contains the word", () => {
    for (const text of [
      "I need help with my homework",
      "help me write an email to my boss",
      "what can you do about back pain",
      "is the restaurant menu vegan?",
      "ممكن مساعدة بالرياضيات",
      "بدي مساعدة بكتابة رسالة",
      "شو بتعمل إذا راسك وجعك",
      "I looked at the menu in the restaurant and could not read it at all",
    ]) {
      expect(asksForMenu(text), text).toBe(false);
    }
  });
});
