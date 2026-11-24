/**
 * Buttons for the delete-my-account flow.
 *
 * Every button does exactly what typing its words does, and nothing more: a tap
 * is turned into the words the flow already understands (`textForAccountTap`)
 * before anything else reads the message, so the subscription gate, the steps
 * and the logs see one path, not two. Typing keeps working.
 *
 * A tap is never trusted further than the words it stands for:
 *   - "Delete" only confirms while the flow is actually waiting for it; a stale
 *     button from yesterday restarts the flow (and asks again) instead.
 *   - "Keep my account" is the engine's own cancel.
 *   - "Cancel deletion" is safe at any time.
 */
import { say } from "./whatsappStrings.ts";
import type { Language } from "./whatsappCatalog.ts";
import type { Tappable } from "./whatsappInteractive.ts";
import { DELETE_CONFIRM_STEP, DELETE_REASON_STEP } from "./whatsappIdentity.ts";

export const ACCOUNT_TAP = {
  delete: "acct_delete_yes",
  keep: "acct_delete_keep",
  skip: "acct_delete_skip",
  cancel: "acct_delete_cancel",
} as const;

const ACCOUNT_TAP_IDS: readonly string[] = Object.values(ACCOUNT_TAP);

export const isAccountTap = (id: string | null | undefined): boolean =>
  !!id && ACCOUNT_TAP_IDS.includes(id);

/** The words this tap stands for, or null when the id is not ours. */
export function textForAccountTap(id: string | null | undefined, step: string | null | undefined): string | null {
  switch (id) {
    case ACCOUNT_TAP.delete:
      // Only a flow that is waiting for the word may be confirmed by a tap.
      return step === DELETE_CONFIRM_STEP ? "DELETE" : "delete my account";
    case ACCOUNT_TAP.keep:
      return "#";
    case ACCOUNT_TAP.skip:
      return step === DELETE_REASON_STEP ? "skip" : "#";
    case ACCOUNT_TAP.cancel:
      return "cancel deletion";
    default:
      return null;
  }
}

export type AccountButtonSet = "confirm" | "reason" | "done";

type ButtonKey = "deleteBtnDelete" | "deleteBtnKeep" | "deleteBtnSkip" | "deleteBtnCancel";

/**
 * The body with its buttons. Meta allows 20 characters on a button, and a
 * test measures every title in every language rather than trusting the eye.
 */
export function accountButtons(set: AccountButtonSet, body: string, language: Language): Tappable {
  const row = (id: string, key: ButtonKey) => ({
    type: "reply" as const,
    reply: { id, title: say(key, language) },
  });
  const buttons = set === "confirm"
    ? [row(ACCOUNT_TAP.delete, "deleteBtnDelete"), row(ACCOUNT_TAP.keep, "deleteBtnKeep")]
    : set === "reason"
    ? [row(ACCOUNT_TAP.skip, "deleteBtnSkip"), row(ACCOUNT_TAP.keep, "deleteBtnKeep")]
    : [row(ACCOUNT_TAP.cancel, "deleteBtnCancel")];
  return {
    interactive: { type: "button", body: { text: body }, action: { buttons } },
    // The typed words say the same thing if Meta refuses the buttons.
    text: body,
  };
}
