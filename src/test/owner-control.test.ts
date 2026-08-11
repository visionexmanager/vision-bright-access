import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  formatAmbiguityPrompt,
  formatOwnerNotification,
  formatPendingList,
  isOwner,
  normalizePhone,
  parseOwnerCommand,
} from "../../supabase/functions/_shared/ownerControl.ts";

const migration = readFileSync("supabase/migrations/20260902000000_owner_control_and_escalations.sql", "utf8");
const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
const ownerControl = readFileSync("supabase/functions/_shared/ownerControl.ts", "utf8");

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
    expect(webhook).toContain('existing?.control === "human"');
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
