// 20261067 — the Data Hub's control layer, executed in PGlite. Metadata only: who may write it
// (the service role, through two functions), who may read it (staff), and that nobody else can do either.
//
//   npm i --no-save @electric-sql/pglite
//   node scripts/sql/data-hub-scenarios.mjs
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { STUBS } from "./gate-stubs.mjs";

const db = new PGlite();
await db.exec(STUBS);
await db.exec(`
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
    AS $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
`);
const migration = readFileSync("supabase/migrations/20261067000000_data_hub_registry.sql", "utf8");
await db.exec(migration);
await db.exec(migration); // re-runnable

let fail = 0;
const expect = (label, cond) => { if (!cond) fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${label}`); };
const u = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const as = (id) => db.exec(`select set_config('test.uid', '${id ?? ""}', false)`);
const rejects = async (fn) => { try { await fn(); return null; } catch (e) { return String(e.message ?? e); } };
for (const n of [1, 2]) await db.exec(`INSERT INTO auth.users VALUES ('${u(n)}')`);
await db.exec(`INSERT INTO user_roles VALUES ('${u(2)}','admin')`);

const snapshot = (over = {}) => ({
  measured_at: "2026-10-01T00:00:00Z", path: "/var/lib/visionex/data", state: "ok",
  disk: { total_bytes: 400e9, used_bytes: 60e9, free_bytes: 340e9, free_percent: 85 },
  budget: { configured_gb: 100, effective_gb: 100, reserve_gb: 10, emergency_free_percent: 8 },
  data_hub: { datasets_bytes: 80e6, indexes_bytes: 0, global_cache_bytes: 0, asset_cache_bytes: 0, conversion_cache_bytes: 0, temporary_bytes: 0, reserved_bytes: 10e9, total_bytes: 80e6, remaining_budget_bytes: 99.9e9 },
  ...over,
});
const dataset = (over = {}) => ({ dataset: "unicode-ucd", group: "unicode", version: "2026-10-01", source_host: "www.unicode.org", sha256: "a".repeat(64), payload_bytes: 5657953, extracted_bytes: 79e6, installed_at: "2026-10-01T00:05:00Z", ...over });
const asRole = async (role, fn) => { await db.exec(`SET ROLE ${role}`); try { return await fn(); } finally { await db.exec("RESET ROLE"); } };

// ── Writing: only the service role, only through the functions ──
const id1 = await asRole("service_role", async () => (await db.query("select public.datahub_record_snapshot($1::jsonb) id", [JSON.stringify(snapshot())])).rows[0].id);
expect("the service role records a measurement", Number(id1) > 0);
await asRole("service_role", () => db.query("select public.datahub_record_dataset($1::jsonb)", [JSON.stringify(dataset())]));
await asRole("service_role", () => db.query("select public.datahub_record_dataset($1::jsonb)", [JSON.stringify(dataset({ version: "2026-10-08", sha256: "b".repeat(64) }))]));
const ds = (await db.query("select slug, active_version from datahub_datasets")).rows;
const vs = (await db.query("select count(*)::int n from datahub_versions")).rows[0].n;
expect("a dataset is recorded once and points at its newest version", ds.length === 1 && ds[0].active_version === "2026-10-08");
expect("both versions are kept in the history", vs === 2);
await asRole("service_role", () => db.query("select public.datahub_record_dataset($1::jsonb)", [JSON.stringify(dataset({ version: "2026-10-08", sha256: "c".repeat(64) }))]));
expect("recording the same version again updates it, it does not duplicate", (await db.query("select count(*)::int n from datahub_versions")).rows[0].n === 2);

for (const role of ["anon", "authenticated"]) {
  expect(`${role} cannot call the snapshot writer`, /permission denied/i.test((await asRole(role, () => rejects(() => db.query("select public.datahub_record_snapshot($1::jsonb)", [JSON.stringify(snapshot())]))) ) ?? ""));
  expect(`${role} cannot call the dataset writer`, /permission denied/i.test((await asRole(role, () => rejects(() => db.query("select public.datahub_record_dataset($1::jsonb)", [JSON.stringify(dataset())]))) ) ?? ""));
  expect(`${role} cannot insert a row directly`, /permission denied/i.test((await asRole(role, () => rejects(() => db.query("insert into datahub_datasets (slug, group_name) values ('x','y')")))) ?? ""));
  expect(`${role} cannot update or delete`, /permission denied/i.test((await asRole(role, () => rejects(() => db.query("delete from datahub_versions")))) ?? ""));
}

// ── Bad input is refused, not stored ──
for (const [label, bad] of [
  ["a snapshot with no disk block", { ...snapshot(), disk: undefined }],
  ["a snapshot in an unknown state", snapshot({ state: "fine" })],
  ["a negative size", snapshot({ disk: { total_bytes: -1, used_bytes: 0, free_bytes: 0 } })],
]) {
  const r = await asRole("service_role", () => rejects(() => db.query("select public.datahub_record_snapshot($1::jsonb)", [JSON.stringify(bad)])));
  expect(`${label} is refused`, r !== null);
}
for (const [label, bad] of [
  ["a dataset with a path in its name", dataset({ dataset: "../etc/passwd" })],
  ["a dataset with a bad checksum", dataset({ sha256: "zz" })],
  ["a dataset with no version", dataset({ version: undefined })],
]) {
  const r = await asRole("service_role", () => rejects(() => db.query("select public.datahub_record_dataset($1::jsonb)", [JSON.stringify(bad)])));
  expect(`${label} is refused`, r !== null);
}
expect("nothing bad was stored", (await db.query("select count(*)::int n from datahub_datasets")).rows[0].n === 1);

// ── History is bounded ──
await asRole("service_role", async () => {
  for (let i = 0; i < 3; i++) await db.query("select public.datahub_record_snapshot($1::jsonb)", [JSON.stringify(snapshot())]);
});
expect("the measurements so far are all there", (await db.query("select count(*)::int n from datahub_storage_snapshots")).rows[0].n === 4);

// ── Reading: staff only ──
await as(u(1));
const plain = await asRole("authenticated", () => rejects(() => db.query("select public.datahub_admin_status()")));
expect("a signed-in user who is not staff is refused the status", /Not authorized/.test(plain ?? ""));
expect("…and sees no row of the tables either", (await asRole("authenticated", () => db.query("select count(*)::int n from datahub_storage_snapshots"))).rows[0].n === 0);
await as(null);
expect("a signed-out caller cannot call it", /permission denied|Not authorized/.test((await asRole("anon", () => rejects(() => db.query("select public.datahub_admin_status()")))) ?? ""));
await as(u(2));
const status = (await asRole("authenticated", () => db.query("select public.datahub_admin_status() s"))).rows[0].s;
expect("staff read the latest measurement", status.storage?.state === "ok" && Number(status.storage.disk_free_bytes) === 340e9);
expect("…and the datasets with their active version", status.datasets.length === 1 && status.datasets[0].active_version === "2026-10-08" && status.datasets[0].slug === "unicode-ucd");
expect("…and nothing in it is a cost, a secret or an address", !/cost|secret|token|key|https?:/i.test(JSON.stringify(status)));
expect("staff read the tables directly", (await asRole("authenticated", () => db.query("select count(*)::int n from datahub_storage_snapshots"))).rows[0].n === 4);

console.log(fail === 0 ? "\nALL PASS" : `\n${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
