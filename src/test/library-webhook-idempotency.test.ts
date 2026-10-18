import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// The migration was executed in PGlite (a second delivery of the same checkout
// is rejected by each unique index, legacy NULL rows coexist, a re-run is safe,
// and pre-existing duplicate licences make it skip instead of fail). This file
// pins the shape so a later edit cannot quietly bring the double count back.

const read = (path: string) => readFileSync(resolve(__dirname, "../..", path), "utf8").replace(/\r\n/g, "\n");
const sql = read("supabase/migrations/20261070000000_library_webhook_idempotency.sql");
const fn = read("supabase/functions/library-stripe-webhook/index.ts");

describe("library webhook idempotency migration", () => {
  it("is additive: no drops, deletes or rewrites", () => {
    expect(sql).not.toMatch(/\bDROP\s+(TABLE|COLUMN)\b|\bDELETE\s+FROM\b|\bTRUNCATE\b|\bUPDATE\s+public\./i);
  });

  it("keys donations, rentals and licences by their checkout", () => {
    expect(sql).toContain("library_donations_checkout_session_uniq");
    expect(sql).toContain("library_borrowed_books_purchase_uniq");
    expect(sql).toContain("library_licenses_purchase_uniq");
  });

  it("does not let an existing duplicate licence fail the deploy", () => {
    expect(sql).toMatch(/HAVING count\(\*\) > 1/);
    expect(sql).toMatch(/RAISE NOTICE/);
  });
});

describe("library-stripe-webhook replay safety", () => {
  it("stores the donation under the checkout session id and ignores a duplicate", () => {
    expect(fn).toMatch(/stripe_checkout_session_id: session\.id/);
    expect(fn).toMatch(/onConflict: "stripe_checkout_session_id", ignoreDuplicates: true/);
  });

  it("looks for an existing rental before inserting, and tolerates the unique violation", () => {
    expect(fn).toMatch(/\.eq\("purchase_id", purchases\[0\]\.id\)\.maybeSingle\(\)/);
    expect(fn).toMatch(/rentalError\.code !== "23505"/);
  });

  it("keys the licence by purchase and ignores a duplicate", () => {
    expect(fn).toMatch(/onConflict: "purchase_id", ignoreDuplicates: true/);
  });

  it("no longer uses a bare insert for donations or licences", () => {
    expect(fn).not.toMatch(/from\("library_donations"\)\.insert/);
    expect(fn).not.toMatch(/from\("library_licenses"\)\.insert/);
  });
});
