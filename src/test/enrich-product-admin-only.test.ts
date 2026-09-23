// Phase 2F-1 — enrich-product has always claimed to be admin-only in its own
// comment, but nothing enforced it: any authenticated user could reach it and
// spend OpenAI credits. Fixed the same way provider-hub and
// kids-course-generate already gate their admin-only paths — has_role() via
// RPC, checked before anything else happens.
//
// enrich-product calls Deno.serve() at module scope, so — like every other
// entry point in this suite — it is asserted against as source text rather
// than imported.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const fn = readFileSync("supabase/functions/enrich-product/index.ts", "utf8");

describe("unauthenticated caller is rejected", () => {
  it("refuses with 401 before anything else when no Authorization header is sent", () => {
    const at = fn.indexOf("if (!authHeader) {");
    expect(at).toBeGreaterThan(-1);
    const block = fn.slice(at, at + 200);
    expect(block).toContain("Authorization required");
    expect(block).toContain("status: 401");
  });

  it("also refuses with 401 when the token does not resolve to a user", () => {
    expect(fn).toContain("if (authErr || !user) {");
    const at = fn.indexOf("if (authErr || !user) {");
    const block = fn.slice(at, fn.indexOf("}\n", at));
    expect(block).toContain("status: 401");
  });
});

describe("authenticated non-admin caller is rejected", () => {
  it("calls has_role with the same shape kids-course-generate and library-embed-book already use", () => {
    expect(fn).toContain('await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });');
  });

  it("refuses with 403, not 401, when the caller is signed in but not an admin", () => {
    const at = fn.indexOf("if (isAdmin !== true) {");
    expect(at).toBeGreaterThan(-1);
    const block = fn.slice(at, fn.indexOf("}\n", at));
    expect(block).toContain("status: 403");
    expect(block).toContain("Admin role required");
  });

  it("checks the boolean strictly, so a null/undefined RPC result refuses rather than silently passing", () => {
    // A malformed or unreachable RPC returns { data: null }, and `null !== true`
    // is still a refusal — this must fail closed, not open.
    expect(fn).toContain("isAdmin !== true");
    expect(fn).not.toContain("!isAdmin");
  });
});

describe("authorization happens before any OpenAI call, and only there", () => {
  it("orders the admin check before the body is even read", () => {
    const roleAt = fn.indexOf('supabase.rpc("has_role"');
    const bodyAt = fn.indexOf("await req.json()");
    expect(roleAt).toBeGreaterThan(-1);
    expect(bodyAt).toBeGreaterThan(-1);
    expect(roleAt).toBeLessThan(bodyAt);
  });

  it("orders the admin check before the OpenAI key is even read", () => {
    const roleAt = fn.indexOf('supabase.rpc("has_role"');
    const keyAt = fn.indexOf('Deno.env.get("OPENAI_API_KEY")');
    expect(keyAt).toBeGreaterThan(-1);
    expect(roleAt).toBeLessThan(keyAt);
  });

  it("orders the admin check before the actual provider fetch", () => {
    const roleAt = fn.indexOf('supabase.rpc("has_role"');
    const fetchAt = fn.indexOf('fetch("https://api.openai.com');
    expect(fetchAt).toBeGreaterThan(-1);
    expect(roleAt).toBeLessThan(fetchAt);
  });

  it("returns before reaching the fetch call at all when the check fails — a rejection is a return, not a flag checked later", () => {
    const roleBlock = fn.slice(fn.indexOf("if (isAdmin !== true) {"), fn.indexOf('fetch("https://api.openai.com'));
    expect(roleBlock).toContain("return new Response");
  });
});

describe("an authorized admin keeps the existing behavior, untouched", () => {
  it("still generates with the same model, schema and response shape as before", () => {
    expect(fn).toContain('model: "gpt-4o"');
    expect(fn).toContain('name: "enrich_product"');
    expect(fn).toContain("accessibility_features");
    expect(fn).toContain("target_users");
  });

  it("still passes through a 429 from OpenAI as a 429, unchanged", () => {
    expect(fn).toContain('if (response.status === 429)');
    expect(fn).toContain('status: 429');
  });
});
