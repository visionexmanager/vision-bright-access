// Buttons under a reply.
//
// A feature's answer, a confirmation or an error used to end where the text
// ended, and the sender had to remember the words that lead on. Meta allows up
// to three reply buttons under a message, and unlike a list they are on screen
// at once: nothing to open, nothing to scroll. So the replies that have a
// natural "what next" carry them — and typing keeps working exactly as before,
// because every id here is one the router already resolves to a command, and
// every title is the localised word that same command is typed as.
//
// Pure: no network, no database. The webhook does the sending.

import { LIST_LIMITS } from "./whatsappCatalog.ts";
import type { Language } from "./whatsappCatalog.ts";
import { CONTROL_IDS } from "./whatsappCommands.ts";
import { say } from "./whatsappStrings.ts";
import type { InteractiveButtons, Row, Tappable } from "./whatsappInteractive.ts";

/**
 * What a reply is, for the purpose of what comes after it.
 *
 *   answer    a feature's result: back a step, the top, or help
 *   notice    a refusal or an error: the top, or help
 *   navigate  help itself: back or the top (help after help is a loop)
 */
export type FollowUpContext = "answer" | "notice" | "navigate";

/** The follow-up a reply of this kind gets by default, or null for none. */
export function defaultFollowUp(kind: string): FollowUpContext | null {
  if (kind === "reply") return "answer";
  if (kind === "unsupported") return "notice";
  // "welcome" is the menu's own prompts and "handover" is a person taking over:
  // neither is somebody to steer back to the bot.
  return null;
}

/** The rows for a context, in the order a thumb reaches for them. */
export function followUpRows(context: FollowUpContext, language: Language): Row[] {
  const back: Row = { id: CONTROL_IDS.back, title: say("back", language) };
  const menu: Row = { id: CONTROL_IDS.mainMenu, title: say("mainMenu", language) };
  const help: Row = { id: CONTROL_IDS.help, title: say("helpButton", language) };
  if (context === "answer") return [back, menu, help];
  if (context === "notice") return [menu, help];
  return [back, menu];
}

function buttonsOf(body: string, rows: Row[]): InteractiveButtons | null {
  // A title that does not fit is not shortened: «القائمة الرئيسية…» is not a
  // choice anybody can make. No buttons, and the typed words still work.
  if (rows.some((row) => [...row.title].length > LIST_LIMITS.buttonTitle)) return null;
  return {
    type: "button",
    body: { text: body },
    action: {
      buttons: rows.slice(0, LIST_LIMITS.buttons).map((row) => ({
        type: "reply" as const,
        reply: { id: row.id, title: row.title },
      })),
    },
  };
}

export interface FollowUps {
  /** Sent first, as plain text, when the reply is too long to be a button body. */
  lead: string | null;
  /** The button message that goes out under the reply. */
  tappable: Tappable;
}

/**
 * The reply and its buttons.
 *
 * A button message's body is 1,024 characters. A reply that fits is the body,
 * so the buttons sit directly under the words and it is one message to listen
 * to. A longer one goes out whole as text, followed by a one-line prompt that
 * carries the buttons — never clipped, because a clipped answer is a wrong one.
 *
 * `tappable.text` is the reply itself: when Meta refuses the buttons the sender
 * gets exactly the words they would have read.
 */
export function followUpMessage(body: string, context: FollowUpContext, language: Language): FollowUps | null {
  const rows = followUpRows(context, language);
  const fits = [...body].length <= LIST_LIMITS.body;
  const prompt = say("followUpPrompt", language);
  const interactive = buttonsOf(fits ? body : prompt, rows);
  if (!interactive) return null;
  return {
    lead: fits ? null : body,
    tappable: { interactive, text: fits ? body : prompt },
  };
}
