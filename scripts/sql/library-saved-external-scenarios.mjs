// 20261065 + 20261066 — saving an external Library result, YouTube included. Executed in PGlite over the real
// entitlement migrations (20261062, 20261063), so "who may save" is decided by the
// same plan resolution as everywhere else.
//
//   npm i --no-save @electric-sql/pglite
//   node scripts/sql/library-saved-external-scenarios.mjs
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { STUBS, MIGRATIONS } from "./gate-stubs.mjs";

const db = new PGlite();
await db.exec(STUBS);
await db.exec(`
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
    AS $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
`);
const entitlement = MIGRATIONS.map((f) => readFileSync(f, "utf8")).join("\n");
await db.exec(entitlement);
// The real user_has_section is 20261031's one-liner over user_sections.
await db.exec(`
  CREATE FUNCTION public.user_has_section(_user_id uuid, _section text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = public AS $$ SELECT _section = ANY (public.user_sections(_user_id)) $$;
`);
const saved = readFileSync("supabase/migrations/20261065000000_library_saved_external_items.sql", "utf8");
await db.exec(saved);
await db.exec(saved); // re-runnable
const youtubeMigration = readFileSync("supabase/migrations/20261066000000_library_saved_youtube_references.sql", "utf8");
await db.exec(youtubeMigration);
await db.exec(youtubeMigration); // re-runnable

let fail = 0;
const expect = (label, cond) => { if (!cond) fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${label}`); };
const u = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const as = (id) => db.exec(`select set_config('test.uid', '${id ?? ""}', false)`);
for (const n of [1, 2, 3, 4]) await db.exec(`INSERT INTO auth.users VALUES ('${u(n)}')`);
await db.exec(`
  INSERT INTO profiles VALUES ('${u(1)}', now() + interval '5 days');
  INSERT INTO user_subscriptions (user_id, plan_id, status, ends_at) VALUES ('${u(2)}','basic','active', now() + interval '30 days');
  INSERT INTO user_subscriptions (user_id, plan_id, status, ends_at) VALUES ('${u(4)}','kids','active', now() + interval '30 days');
  INSERT INTO user_roles VALUES ('${u(3)}','admin');
`);

const item = (over = {}) => ({
  id: "europe_pmc:MED_42742570", provider: "europe_pmc", providerName: "Europe PMC", title: "How behaviour can help", contentType: "document",
  description: "An abstract.", creator: "Filho WL", thumbnailUrl: null, externalUrl: "https://europepmc.org/article/MED/42742570",
  downloadUrl: "https://europepmc.org/articles/PMC13576766?pdf=render", license: { name: "CC BY", url: "https://creativecommons.org/licenses/by/4.0/" },
  attribution: "Filho WL, 2026, Europe PMC", language: "eng", publishedAt: "2026-09-21", ...over,
});
const save = async (over, note = null) => (await db.query("select public.library_save_external_item($1::jsonb, $2) id", [JSON.stringify(item(over)), note])).rows[0].id;
const rejects = async (fn) => { try { await fn(); return null; } catch (e) { return String(e.message ?? e); } };
const count = async (uid) => (await db.query("select count(*)::int n from library_saved_external_items where user_id = $1", [uid])).rows[0].n;

// ── Who may save ──
await as(null);
expect("signed out → refused", /Not authenticated/.test((await rejects(() => save())) ?? ""));
await as(u(1));
expect("free week (trial) → refused: the Library is not a trial section", /subscription_required/.test((await rejects(() => save())) ?? ""));
expect("…and nothing was written", (await count(u(1))) === 0);
await as(u(4));
expect("Kids plan (no Library section) → refused", /subscription_required/.test((await rejects(() => save())) ?? ""));
await as(u(2));
const id1 = await save();
expect("Basic (has the Library) → saved", !!id1 && (await count(u(2))) === 1);
expect("saving the same item again is idempotent (one row, same id)", (await save({}, "a note")) === id1 && (await count(u(2))) === 1);
const noted = (await db.query("select note from library_saved_external_items where user_id = $1", [u(2)])).rows[0].note;
expect("…and updates the note", noted === "a note");
await as(u(3));
expect("admin → saved", !!(await save({ id: "doaj:00014186c13b43e5bbaaf71187a02e9c", provider: "doaj" })));

// ── The table constraints are the second lock ──
await as(u(2));
const bad = async (label, over, re) => expect(label, re.test((await rejects(() => save(over))) ?? ""));
await bad("an http:// link is refused", { id: "x_y:1", provider: "x_y", externalUrl: "http://example.org/a" }, /lsei_urls_check|violates check/);
await bad("a javascript: link is refused", { id: "x_y:2", provider: "x_y", externalUrl: "javascript:alert(1)" }, /lsei_urls_check|violates check/);
await bad("a download link with a space is refused", { id: "x_y:3", provider: "x_y", downloadUrl: "https://example.org/a b" }, /lsei_urls_check|violates check/);
await bad("an id that does not start with its provider is refused", { id: "other:5", provider: "x_y" }, /lsei_provider_check|violates check/);
await bad("an id with a space is refused", { id: "x_y:a b", provider: "x_y" }, /lsei_item_id_check|violates check/);
await bad("a title over 300 characters is refused", { id: "x_y:6", provider: "x_y", title: "t".repeat(301) }, /lsei_title_check|violates check/);
await bad("an unknown content type is refused", { id: "x_y:7", provider: "x_y", contentType: "malware" }, /lsei_content_type_check|violates check/);
await bad("no title is refused", { id: "x_y:8", provider: "x_y", title: "" }, /lsei_title_check|violates check/);
expect("a non-object payload is refused", /invalid_item/.test((await rejects(() => db.query("select public.library_save_external_item('[]'::jsonb)"))) ?? ""));
await save({ id: "x_y:9", provider: "x_y", description: "d".repeat(900) });
expect("a description over 600 characters is trimmed, not stored whole",
  (await db.query("select char_length(description) n from library_saved_external_items where item_id = 'x_y:9'")).rows[0].n === 600);

// ── YouTube: a reference to a YouTube resource, and nothing that only looks like one ──
const VIDEO = "dQw4w9WgXcQ";
const CHANNEL = "UCX6OQ3DkcsbYNE6H8uQQuVA";
const PLAYLIST = "PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf";
const yt = (over = {}) => ({
  id: `youtube:${VIDEO}`, provider: "youtube", providerName: "YouTube", title: "A lecture", contentType: "video", creator: "Some Channel",
  externalUrl: `https://www.youtube.com/watch?v=${VIDEO}`, thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
  metadata: { resourceType: "video", channelId: CHANNEL }, ...over,
});
const saveYt = async (over) => (await db.query("select public.library_save_external_item($1::jsonb) id", [JSON.stringify(yt(over))])).rows[0].id;
await as(u(2));
await saveYt();
const storedMeta = (await db.query("select metadata from library_saved_external_items where item_id = $1", [`youtube:${VIDEO}`])).rows[0].metadata;
expect("a YouTube video is saved, with its metadata", storedMeta?.resourceType === "video" && storedMeta?.channelId === CHANNEL);
expect("a YouTube channel is saved", !!(await saveYt({ id: `youtube:channel:${CHANNEL}`, contentType: "channel", externalUrl: `https://www.youtube.com/channel/${CHANNEL}`, thumbnailUrl: null, metadata: { resourceType: "channel", channelId: CHANNEL } })));
expect("a YouTube playlist is saved", !!(await saveYt({ id: `youtube:playlist:${PLAYLIST}`, contentType: "playlist", externalUrl: `https://www.youtube.com/playlist?list=${PLAYLIST}`, thumbnailUrl: null, metadata: { resourceType: "playlist" } })));
const badYt = async (label, over) => expect(label, /lsei_youtube_check|violates check/.test((await rejects(() => saveYt(over))) ?? ""));
await badYt("a 'youtube' row that points at another site is refused", { externalUrl: "https://evil.example/watch?v=dQw4w9WgXcQ" });
await badYt("a YouTube address for a different video than its id is refused", { externalUrl: "https://www.youtube.com/watch?v=aaaaaaaaaaa" });
await badYt("a look-alike host is refused", { externalUrl: "https://www.youtube.com.evil.example/watch?v=dQw4w9WgXcQ" });
await badYt("http is refused", { externalUrl: "http://www.youtube.com/watch?v=dQw4w9WgXcQ" });
await badYt("a video id that is not 11 characters is refused", { id: "youtube:short", externalUrl: "https://www.youtube.com/watch?v=short" });
await badYt("a video typed as a channel is refused", { contentType: "channel" });
await badYt("a channel whose id is not a channel id is refused", { id: "youtube:channel:notachannel", contentType: "channel", externalUrl: "https://www.youtube.com/channel/notachannel" });
await badYt("a playlist address that does not match its id is refused", { id: `youtube:playlist:${PLAYLIST}`, contentType: "playlist", externalUrl: "https://www.youtube.com/playlist?list=PLzzzzzzzzzzzzzzzz" });
await saveYt({ id: "youtube:aaaaaaaaaaa", externalUrl: "https://www.youtube.com/watch?v=aaaaaaaaaaa", metadata: ["x"] });
expect("metadata that is not an object is ignored, not stored", (await db.query("select metadata from library_saved_external_items where item_id = 'youtube:aaaaaaaaaaa'")).rows[0].metadata === null);
await badYt("metadata over 2,000 characters is refused", { metadata: { note: "n".repeat(2100) } });
expect("a channel or playlist type is allowed for another provider too (it is a kind of thing, not a YouTube privilege)",
  !!(await save({ id: "other_src:c1", provider: "other_src", contentType: "channel" })));
expect("metadata is optional", !!(await save({ id: "other_src:nometa", provider: "other_src" })));

// ── The cap ──
await db.exec(`INSERT INTO library_saved_external_items (user_id, item_id, provider, provider_name, title, content_type, external_url)
  SELECT '${u(2)}', 'cap:' || g, 'cap', 'Cap', 'T' || g, 'book', 'https://example.org/' || g
    FROM generate_series(1, 500 - (SELECT count(*) FROM library_saved_external_items WHERE user_id = '${u(2)}')::int) g`);
expect("the shelf holds exactly 500", (await count(u(2))) === 500);
expect("the 501st item is refused", /library_full/.test((await rejects(() => save({ id: "x_y:over", provider: "x_y" }))) ?? ""));
expect("but re-saving one already there is still fine", !!(await save()));

// ── Rows belong to their owner ──
await db.exec("SET ROLE authenticated");
await as(u(3));
const seen = (await db.query("select count(*)::int n from library_saved_external_items")).rows[0].n;
expect("a user sees only their own shelf (the admin has 1 row; Basic's 500 are invisible)", seen === 1);
expect("a direct INSERT is refused (the RPC is the only way in)", /permission denied/.test((await rejects(() => db.query(
  `INSERT INTO library_saved_external_items (user_id,item_id,provider,provider_name,title,content_type,external_url) VALUES ('${u(3)}','a:1','a','A','T','book','https://example.org/x')`))) ?? ""));
expect("a direct UPDATE is refused", /permission denied/.test((await rejects(() => db.query("UPDATE library_saved_external_items SET title = 'x'"))) ?? ""));
await as(u(2));
const foreign = (await db.query("delete from library_saved_external_items where user_id = $1", [u(3)])).affectedRows;
expect("a user cannot delete another user's rows", foreign === 0);
await db.exec("RESET ROLE");
await db.exec("SET ROLE anon");
expect("anon cannot read the table", /permission denied/.test((await rejects(() => db.query("select 1 from library_saved_external_items"))) ?? ""));
expect("anon cannot call the RPC", /permission denied/.test((await rejects(() => db.query("select public.library_save_external_item('{}'::jsonb)"))) ?? ""));
await db.exec("RESET ROLE");

// ── Removing ──
await db.exec("SET ROLE authenticated");
await as(u(2));
expect("unsave removes it and says so", (await db.query("select public.library_unsave_external_item('europe_pmc:MED_42742570') v")).rows[0].v === true);
expect("unsave of something not there says so", (await db.query("select public.library_unsave_external_item('europe_pmc:MED_42742570') v")).rows[0].v === false);
await db.exec("RESET ROLE");
await db.exec(`UPDATE user_subscriptions SET status = 'cancelled' WHERE user_id = '${u(2)}'`);
await db.exec("SET ROLE authenticated");
expect("with the plan lapsed, saving is refused", /subscription_required/.test((await rejects(() => save({ id: "x_y:late", provider: "x_y" }))) ?? ""));
expect("and removing still works (a lapsed plan can tidy its shelf)", (await db.query("select public.library_unsave_external_item('cap:1') v")).rows[0].v === true);
await db.exec("RESET ROLE");

console.log(fail === 0 ? "ALL PASS" : `${fail} FAILURE(S)`);
process.exit(fail === 0 ? 0 : 1);
