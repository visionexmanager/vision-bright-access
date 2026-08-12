import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// request-sourcing became the "request_sourcing" action of contact-form. These
// pin that the contact form is untouched, that the action keeps its own
// protections, and — most importantly — that the privileged approval engine
// did not follow it into an anon-callable endpoint.

const contact = readFileSync("supabase/functions/contact-form/index.ts", "utf8");
const sourcing = readFileSync("supabase/functions/_shared/sourcingRequest.ts", "utf8");
const ownerControl = readFileSync("supabase/functions/owner-control/index.ts", "utf8");
const client = readFileSync("src/lib/api/edgeFunctions.ts", "utf8");

describe("the contact form is unchanged", () => {
  it("treats a request with no action as a contact submission", () => {
    expect(contact).toContain('typeof peek.action === "string" ? peek.action : "contact"');
  });

  it("keeps its validation, routing, storage and mail", () => {
    for (const marker of [
      "Missing required fields", "Invalid or oversized field", "isValidEmail",
      "resolveDepartment", 'from("service_requests")', "buildAutoReply",
      "buildInternalNotification", "RESEND_API_KEY",
    ]) {
      expect(contact, `lost ${marker}`).toContain(marker);
    }
  });

  it("still treats mail as best-effort after the row is stored", () => {
    const insertFailure = contact.indexOf('"Failed to save request"');
    const mail = contact.indexOf('Deno.env.get("RESEND_API_KEY")');
    expect(insertFailure).toBeGreaterThan(-1);
    expect(mail).toBeGreaterThan(insertFailure);
  });
});

describe("the action is gated and keeps its protections", () => {
  it("accepts exactly two actions", () => {
    expect(contact).toContain('allowed: ["contact", "request_sourcing"]');
    expect(contact).toContain("Unknown action");
  });

  it("cannot dispatch to an arbitrary handler", () => {
    expect(contact).not.toMatch(/await import\(|new Function|eval\(/);
    expect(contact).toContain('if (action === "request_sourcing")');
  });

  it("peeks on a clone so the handler receives an unread body", () => {
    expect(contact).toContain("await req.clone().json()");
    expect(contact).toContain("return handleSourcingRequest(req);");
  });

  it("keeps the anonymous rate limit", () => {
    expect(sourcing).toContain("MAX_REQUESTS_PER_HOUR");
    expect(sourcing).toContain("Too many requests");
  });

  it("keeps the input bounds", () => {
    expect(sourcing).toContain("MAX_MESSAGE");
    expect(sourcing).toContain("MAX_TRANSCRIPT_TURNS");
  });

  it("still preserves the conversation so nobody repeats themselves", () => {
    expect(sourcing).toContain("transcript");
  });

  it("still creates an escalation and an approval", () => {
    expect(sourcing).toContain('from("support_escalations")');
    expect(sourcing).toContain('from("owner_approvals")');
  });

  it("still refuses to imply an order", () => {
    const codeOnly = sourcing.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
    expect(codeOnly).not.toMatch(/order[_ ]?number|tracking[_ ]?number|shipped/i);
    expect(sourcing).toContain('status: "requires_sourcing_confirmation"');
  });
});

describe("the privileged approval engine did NOT move", () => {
  it("contact-form cannot decide or transition anything", () => {
    // This endpoint is anon-callable. Reaching the decision RPCs from here
    // would let an unauthenticated caller drive the state machine.
    //
    // Comments are stripped first: a header explaining that the privileged
    // engine stays behind owner-control names those RPCs precisely because it
    // does not call them, and matching prose would punish the explanation.
    const codeOnly = (source: string) =>
      source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

    for (const rpc of ["decide_owner_approval", "transition_escalation", "mark_escalation_viewed"]) {
      expect(codeOnly(contact), `contact-form reaches ${rpc}`).not.toContain(rpc);
      expect(codeOnly(sourcing), `the sourcing action reaches ${rpc}`).not.toContain(rpc);
    }
  });

  it("owner-control remains a standalone admin-gated function", () => {
    expect(existsSync("supabase/functions/owner-control/index.ts")).toBe(true);
    expect(ownerControl).toContain('.eq("role", "admin")');
    expect(ownerControl).toContain('rpc("decide_owner_approval"');
    expect(ownerControl).toContain('rpc("transition_escalation"');
  });

  it("the sourcing action only inserts rows in the waiting state", () => {
    // It creates work for a human; it never resolves it.
    expect(sourcing).not.toMatch(/state:\s*["'](APPROVED|REJECTED|COMPLETED)/);
  });
});

describe("the old function is gone and the client follows", () => {
  it("removed the standalone function", () => {
    expect(existsSync("supabase/functions/request-sourcing")).toBe(false);
  });

  it("calls contact-form with the action instead", () => {
    expect(client).toContain('fn: "contact-form"');
    expect(client).toContain('action: "request_sourcing"');
  });

  it("dropped the retired name from the function-name union", () => {
    const types = readFileSync("src/lib/types/ai.ts", "utf8");
    expect(types).not.toContain('"request-sourcing"');
  });
});
