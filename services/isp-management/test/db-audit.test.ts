import { describe, expect, it } from "vitest";
import { verifyAuditChain, writeAudit } from "../src/audit.js";
import { assertEnvironment } from "../src/container.js";
import { harness } from "./helpers.js";

describe("migrations and audit log", () => {
  it("applies once and is idempotent on rerun", async () => {
    const h = await harness();
    const { runMigrations } = await import("../src/db.js");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    expect(await runMigrations(h.c.db, join(dirname(fileURLToPath(import.meta.url)), "..", "migrations"))).toEqual([]);
  });

  it("is append-only: UPDATE, DELETE and TRUNCATE are rejected", async () => {
    const h = await harness();
    await writeAudit(h.c.db, { actorType: "SYSTEM", action: "T", result: "SUCCESS" });
    await expect(h.c.db.query("UPDATE audit_logs SET result='X'")).rejects.toThrow(/append-only/);
    await expect(h.c.db.query("DELETE FROM audit_logs")).rejects.toThrow(/append-only/);
    await expect(h.c.db.query("TRUNCATE audit_logs")).rejects.toThrow(/append-only/);
  });

  it("detects a tampered or removed row in the hash chain", async () => {
    const h = await harness();
    for (let i = 0; i < 3; i++) await writeAudit(h.c.db, { actorType: "SYSTEM", action: `A${i}`, result: "SUCCESS" });
    expect(await verifyAuditChain(h.c.db)).toMatchObject({ ok: true, checked: 3 });
    // Someone with table-owner rights drops the trigger and edits history.
    await h.c.db.exec("DROP TRIGGER audit_logs_no_update ON audit_logs; UPDATE audit_logs SET action='EDITED' WHERE id = 2;");
    expect(await verifyAuditChain(h.c.db)).toMatchObject({ ok: false, brokenAt: 2 });
  });

  it("redacts secrets in audit metadata", async () => {
    const h = await harness();
    await writeAudit(h.c.db, { actorType: "SYSTEM", action: "T", result: "SUCCESS", metadata: { password: "hunter2", note: "ok" } });
    const r = await h.c.db.query<{ metadata: object }>("SELECT metadata FROM audit_logs");
    expect(JSON.stringify(r.rows[0]!.metadata)).not.toContain("hunter2");
  });

  it("refuses to run a production process against a development database", async () => {
    const h = await harness();
    await expect(assertEnvironment(h.c.db, "production")).rejects.toThrow(/mismatch/);
  });
});
