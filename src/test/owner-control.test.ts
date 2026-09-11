import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  formatAmbiguityPrompt,
  formatOwnerHelp,
  formatOwnerNotification,
  formatPendingList,
  isOwner,
  normalizePhone,
  parseOwnerCommand,
} from "../../supabase/functions/_shared/ownerControl.ts";

const migration = readFileSync("supabase/migrations/20260902000000_owner_control_and_escalations.sql", "utf8");
const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
const ownerControl = readFileSync("supabase/functions/_shared/ownerControl.ts", "utf8");
const triage = readFileSync("supabase/functions/_shared/whatsappTriage.ts", "utf8");

describe("owner authorization", () => {
  it("matches the configured number however it is written", () => {
    expect(isOwner("96170750609", "+961 70 750 609")).toBe(true);
    expect(isOwner("96170750609", "0096170750609")).toBe(true);
    expect(isOwner("96170750609", "96170750609")).toBe(true);
  });

  it("rejects any other number", () => {
    // A WhatsApp message from an unknown number is a customer message, never
    // a command, whatever it says.
    expect(isOwner("96170750608", "96170750609")).toBe(false);
    expect(isOwner("15551234567", "96170750609")).toBe(false);
  });

  it("treats an unconfigured owner as nobody", () => {
    // An unconfigured system must not promote the first caller to owner.
    expect(isOwner("96170750609", null)).toBe(false);
    expect(isOwner("96170750609", "")).toBe(false);
    expect(isOwner("96170750609", "123")).toBe(false);
  });

  it("will not match on a short suffix collision", () => {
    expect(isOwner("999609", "96170750609")).toBe(false);
  });

  it("normalizes to digits", () => {
    expect(normalizePhone("+961 (70) 750-609")).toBe("96170750609");
    expect(normalizePhone(null)).toBe("");
  });
});

describe("owner command parsing", () => {
  it("reads approve and reject in both languages", () => {
    expect(parseOwnerCommand("approve").kind).toBe("approve");
    expect(parseOwnerCommand("وافق").kind).toBe("approve");
    expect(parseOwnerCommand("reject").kind).toBe("reject");
    expect(parseOwnerCommand("ارفض").kind).toBe("reject");
  });

  it("extracts a reference when one is given", () => {
    const command = parseOwnerCommand("approve A7K2M");
    expect(command.kind).toBe("approve");
    expect(command.reference).toBe("A7K2M");
  });

  it("uppercases a lowercase reference", () => {
    expect(parseOwnerCommand("reject a7k2m").reference).toBe("A7K2M");
  });

  it("treats a bare digit as a choice carrying no reference", () => {
    // The caller must resolve this against exactly one pending action; the
    // parser must not invent which one it meant.
    const command = parseOwnerCommand("2");
    expect(command.choice).toBe(2);
    expect(command.kind).toBe("approve");
    expect(command.reference).toBeNull();
  });

  it("maps the documented numbering", () => {
    expect(parseOwnerCommand("1").kind).toBe("take_over");
    expect(parseOwnerCommand("2").kind).toBe("approve");
    expect(parseOwnerCommand("3").kind).toBe("reject");
    expect(parseOwnerCommand("4").kind).toBe("more_info");
  });

  it("recognises takeover and return in both languages", () => {
    expect(parseOwnerCommand("take over").kind).toBe("take_over");
    expect(parseOwnerCommand("أتولى").kind).toBe("take_over");
    expect(parseOwnerCommand("return to ai").kind).toBe("return_to_ai");
    expect(parseOwnerCommand("ارجع للذكاء").kind).toBe("return_to_ai");
  });

  it("does not read a command out of ordinary conversation", () => {
    expect(parseOwnerCommand("what is the weather like").kind).toBe("unknown");
  });

  it("keeps a note alongside the decision", () => {
    expect(parseOwnerCommand("reject A7K2M too expensive").note).toContain("too expensive");
  });
});

describe("ambiguity is refused, not guessed", () => {
  it("asks which one when several decisions are pending", () => {
    const prompt = formatAmbiguityPrompt([
      { reference: "A7K2M", action_type: "refund", title: "Refund request", summary: null },
      { reference: "B3XQP", action_type: "content_publish", title: "Publish post", summary: null },
    ]);
    expect(prompt).toContain("A7K2M");
    expect(prompt).toContain("B3XQP");
    expect(prompt).toMatch(/ambiguous/i);
  });

  it("the webhook only accepts a bare number when exactly one is pending", () => {
    expect(webhook).toContain("pending.length === 1");
    expect(webhook).toContain("formatAmbiguityPrompt(pending)");
  });

  it("lists nothing rather than inventing work", () => {
    expect(formatPendingList([])).toMatch(/Nothing is waiting/);
  });
});

describe("notification format", () => {
  const message = formatOwnerNotification({
    reference: "A7K2M",
    headline: "HUMAN INTERVENTION REQUIRED",
    customer: "Sara",
    channel: "Website AI",
    request: "Wants an externally sourced accessibility product.",
    aiSummary: "Asked for a braille display under $900.",
    suggestedAction: "Confirm sourcing from a verified supplier.",
  });

  it("carries the reference so a reply is never ambiguous", () => {
    expect(message).toContain("[A7K2M]");
    expect(message).toContain('"approve A7K2M"');
  });

  it("offers the four documented options", () => {
    expect(message).toContain("1. Take over");
    expect(message).toContain("2. Approve");
    expect(message).toContain("3. Reject");
    expect(message).toContain("4. Ask AI for more information");
  });

  it("includes the case detail so nobody has to repeat it", () => {
    expect(message).toContain("Sara");
    expect(message).toContain("braille display");
    expect(message).toContain("Confirm sourcing");
  });
});

describe("state machines are enforced by the database", () => {
  it("declares both state sets", () => {
    for (const state of ["WAITING_FOR_OWNER", "OWNER_VIEWED", "OWNER_APPROVED", "OWNER_REJECTED",
                         "OWNER_RESPONDED", "RETURNED_TO_AI", "RESOLVED", "FAILED"]) {
      expect(migration, `escalation state ${state}`).toContain(state);
    }
    for (const state of ["WAITING_FOR_APPROVAL", "APPROVED", "REJECTED", "PROCESSING", "COMPLETED", "FAILED"]) {
      expect(migration, `approval state ${state}`).toContain(state);
    }
  });

  it("rejects an illegal transition in a trigger, not a comment", () => {
    expect(migration).toContain("enforce_approval_transition");
    expect(migration).toContain("enforce_escalation_transition");
    expect(migration).toContain("Illegal approval transition");
    expect(migration).toContain("Illegal escalation transition");
  });

  it("makes decided approvals terminal", () => {
    // Replay protection: a redelivered owner reply must not overwrite a
    // decision that was already recorded.
    expect(migration).toMatch(/WHEN 'REJECTED'\s+THEN ARRAY\[\]::text\[\]/);
    expect(migration).toMatch(/WHEN 'COMPLETED' THEN ARRAY\[\]::text\[\]/);
  });
});

describe("decision safety", () => {
  it("claims the approval atomically and only while pending", () => {
    expect(migration).toContain("AND state = 'WAITING_FOR_APPROVAL'");
    expect(migration).toContain("AND expires_at > now()");
    expect(migration).toContain("'not_pending'");
  });

  it("is service-role only", () => {
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.decide_owner_approval");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.decide_owner_approval(text, boolean, text, text, text) TO service_role");
  });

  it("writes an audit row and a feedback event for every decision", () => {
    expect(migration).toContain("INSERT INTO public.audit_logs");
    expect(migration).toContain("INSERT INTO public.ai_feedback_events");
    expect(migration).toContain("owner_approved");
    expect(migration).toContain("owner_rejection");
  });

  it("never stores a full phone number in the audit", () => {
    expect(migration).toContain("decided_by_masked");
    expect(migration).toContain("right(_identifier, 4)");
  });

  it("keeps both tables admin-read and service-write only", () => {
    expect(migration).toContain("ALTER TABLE public.support_escalations ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("ALTER TABLE public.owner_approvals     ENABLE ROW LEVEL SECURITY");
    expect(migration).not.toMatch(/owner_approvals[\s\S]{0,300}FOR SELECT TO public/);
    expect(migration).not.toMatch(/FOR (INSERT|UPDATE|ALL) TO authenticated[\s\S]{0,120}owner_approvals/);
  });
});

describe("human takeover", () => {
  it("silences the assistant while a person owns the conversation", () => {
    // One function answers this now — `assistantIsSilenced` — because the
    // condition was written out in two places and only one of them was ever
    // corrected. An owner takeover is the half of it that never expires.
    expect(webhook).toContain("assistantIsSilenced(");
    expect(triage).toContain('if (row.control === "human") return true;');
  });

  it("has explicit ai / human control states", () => {
    expect(migration).toContain("control text NOT NULL DEFAULT 'ai'");
    expect(migration).toContain("CHECK (control IN ('ai', 'human'))");
    expect(migration).toContain("control_changed_at");
    expect(migration).toContain("control_changed_by");
  });

  it("records takeover and resume as feedback", () => {
    expect(webhook).toContain("owner_correction");
    expect(webhook).toContain("Owner returned the conversation to the AI");
  });
});

describe("owner contact stays configurable and private", () => {
  it("reads the number from site_settings, never from code", () => {
    expect(webhook).toContain('.eq("key", "owner_contact")');
    // No phone number literal anywhere in the owner path.
    expect(webhook).not.toMatch(/\b\d{9,15}\b/);
    expect(ownerControl).not.toMatch(/\b\d{9,15}\b/);
  });

  it("rate limits owner commands", () => {
    expect(webhook).toContain("OWNER_COMMAND_LIMIT_PER_HOUR");
  });

  it("checks authorization before parsing anything as a command", () => {
    const authAt = webhook.indexOf("isOwner(incoming.from, configuredOwner)");
    const handleAt = webhook.indexOf("handleOwnerCommand(db, incoming.from");
    expect(authAt).toBeGreaterThan(-1);
    expect(handleAt).toBeGreaterThan(authAt);
  });
});

/** The body of `handleOwnerCommand`, so order can be asserted inside it. */
function handleOwnerCommandBody(): string {
  const start = webhook.indexOf("async function handleOwnerCommand(");
  expect(start).toBeGreaterThan(0);
  const end = webhook.indexOf("\nasync function ", start + 1);
  return webhook.slice(start, end > 0 ? end : undefined);
}

// ── The slash, and the owner's right to hold a conversation ─────────────────
//
// The words this parser matches — "ok", "no", «تم», «لا», "details" — are among
// the most common things anybody says, and the owner is a person who also talks
// to their own assistant. Every one of those used to be read as a command: an
// audit row written, a rate-limit slot spent, and "Nothing is waiting for a
// decision right now." arriving in the middle of a conversation about something
// else entirely.
//
// A slash is always a command. Without one, the words act only while a decision
// is actually waiting.

describe("a slash is always a command", () => {
  it("reads every command name after a slash", () => {
    const cases: Array<[string, string]> = [
      ["/approve", "approve"],
      ["/ok", "approve"],
      ["/yes", "approve"],
      ["/reject", "reject"],
      ["/no", "reject"],
      ["/takeover", "take_over"],
      ["/ai", "return_to_ai"],
      ["/resume", "return_to_ai"],
      ["/info", "more_info"],
      ["/details", "more_info"],
      ["/pending", "list_pending"],
      ["/list", "list_pending"],
      ["/help", "help"],
      ["/commands", "help"],
    ];
    for (const [input, kind] of cases) {
      const command = parseOwnerCommand(input);
      expect(command.kind, input).toBe(kind);
      expect(command.explicit, input).toBe(true);
    }
  });

  it("tolerates the spacing and casing a phone keyboard produces", () => {
    for (const input of ["/APPROVE", " / approve ", "/Approve"]) {
      expect(parseOwnerCommand(input).kind, input).toBe("approve");
      expect(parseOwnerCommand(input).explicit, input).toBe(true);
    }
  });

  it("keeps the reference and the note that follow it", () => {
    const command = parseOwnerCommand("/approve ABCDE ship it today");
    expect(command.kind).toBe("approve");
    expect(command.reference).toBe("ABCDE");
    expect(command.note).toBe("ship it today");
    expect(command.explicit).toBe(true);
  });

  it("reads a numbered choice after a slash", () => {
    expect(parseOwnerCommand("/2")).toMatchObject({ kind: "approve", choice: 2, explicit: true });
    expect(parseOwnerCommand("/1")).toMatchObject({ kind: "take_over", choice: 1, explicit: true });
  });

  it("still reads the words it always read, after a slash", () => {
    // `/وافق` and `/take over` are not in the explicit vocabulary and fall
    // through to the natural-language matching, which is the point of removing
    // the slash before parsing rather than branching on it.
    expect(parseOwnerCommand("/وافق").kind).toBe("approve");
    expect(parseOwnerCommand("/take over").kind).toBe("take_over");
  });

  it("lets an explicit name beat the same word inside a sentence", () => {
    // "/no" is a rejection. Bare "no" in a longer sentence is matched by the
    // same list, which is exactly why the explicit form is checked first.
    expect(parseOwnerCommand("/no not that one").kind).toBe("reject");
  });
});

describe("without a slash, the owner is talking", () => {
  it("marks an ordinary message as not explicit", () => {
    for (const input of ["ok", "تم", "no", "لا", "details", "approve"]) {
      expect(parseOwnerCommand(input).explicit, input).toBe(false);
    }
  });

  it("still parses the words, because they still work while something waits", () => {
    // The notification says "reply with a number", and it stays true: the
    // parser is unchanged, only the caller's gate is new.
    expect(parseOwnerCommand("ok").kind).toBe("approve");
    expect(parseOwnerCommand("2").kind).toBe("approve");
    expect(parseOwnerCommand("تم").kind).toBe("approve");
  });

  it("the webhook drops it when nothing is actually waiting", () => {
    // The gate, asserted against the source because the alternative is running
    // a webhook. Returning null is what sends the message on to the assistant.
    expect(webhook).toContain(
      "if (!command.explicit && !command.reference && pending.length === 0) return null;",
    );
  });

  it("the webhook reads what is pending before it spends anything", () => {
    // The gate needs the pending list, so the read has to come first — which
    // also means an ordinary «تم» no longer writes an audit row or burns a
    // slot of the hourly limit.
    //
    // Measured inside the function rather than across the file: the rate
    // limit's constant is declared hundreds of lines above its use, and an
    // index into the whole source would compare the wrong two things.
    const body = handleOwnerCommandBody();
    const pendingRead = body.indexOf('.from("owner_approvals")');
    const rateLimitCheck = body.indexOf(">= OWNER_COMMAND_LIMIT_PER_HOUR");
    const auditWrite = body.indexOf("owner_command_${command.kind}");
    for (const [name, at] of [["pending read", pendingRead], ["rate limit", rateLimitCheck], ["audit", auditWrite]] as const) {
      expect(at, name).toBeGreaterThan(0);
    }
    expect(pendingRead).toBeLessThan(rateLimitCheck);
    expect(pendingRead).toBeLessThan(auditWrite);
  });

  it("keeps a named reference working either way", () => {
    // Nobody types "ABCDE" by accident, so a reference is an instruction even
    // without a slash — and the webhook's gate says so.
    const command = parseOwnerCommand("approve ABCDE");
    expect(command.reference).toBe("ABCDE");
    expect(command.explicit).toBe(false);
    expect(webhook).toContain("!command.reference");
  });
});

describe("/help", () => {
  it("names every command the parser accepts", () => {
    const help = formatOwnerHelp();
    for (const command of ["/pending", "/approve", "/reject", "/takeover", "/ai", "/info", "/help"]) {
      expect(help, command).toContain(command);
    }
  });

  it("says the rule the owner actually needs to know", () => {
    expect(formatOwnerHelp()).toContain("/ is always a command");
  });

  it("costs nothing: no lookup, no rate-limit slot, no audit row", () => {
    // Answered before any of those, which is what makes it safe to type twice.
    const body = handleOwnerCommandBody();
    const help = body.indexOf('if (command.kind === "help") return formatOwnerHelp();');
    expect(help).toBeGreaterThan(0);
    expect(help).toBeLessThan(body.indexOf('.from("owner_approvals")'));
  });
});
