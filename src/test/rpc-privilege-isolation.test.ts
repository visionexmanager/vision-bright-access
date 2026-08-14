import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Guards the fix for a live exposure: `REVOKE ALL ON FUNCTION … FROM PUBLIC`
// does not remove EXECUTE on this project. Supabase grants it to anon,
// authenticated and service_role directly through ALTER DEFAULT PRIVILEGES, and
// revoking PUBLIC leaves a direct grant standing — so a SECURITY DEFINER
// function protected that way runs, with the owner's privileges, for anyone
// holding the browser's anon key.
//
// This does not grep for the word REVOKE. It replays every privilege statement
// in every migration, in filename order, over a model that starts each function
// where Supabase starts it — granted to anon, authenticated and service_role —
// and then asserts the state each function ends in. A later migration that
// re-grants EXECUTE to anon fails here even though the REVOKE line is still
// sitting in the file it was written in.

const MIGRATIONS = "supabase/migrations";
const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();

const ISOLATION_MIGRATION = "20260906000000_rpc_execute_isolation.sql";

/** What Supabase grants on every newly created function in `public`. */
const DEFAULT_GRANTS = ["anon", "authenticated", "service_role"];

/** Names the isolation migration declares. Read from the file, not restated. */
function protectedNames(): string[] {
  const sql = readFileSync(`${MIGRATIONS}/${ISOLATION_MIGRATION}`, "utf8");
  const body = sql.slice(sql.indexOf("ARRAY["), sql.indexOf("];", sql.indexOf("ARRAY[")));
  return [...body.replace(/--[^\n]*/g, "").matchAll(/'(\w+)'/g)].map((m) => m[1]);
}

/**
 * Replays creation, REVOKE and GRANT across every migration and returns the
 * roles holding EXECUTE at the end.
 */
function finalGrants(): Map<string, Set<string>> {
  const state = new Map<string, Set<string>>();

  const ensure = (name: string) => {
    if (!state.has(name)) state.set(name, new Set(DEFAULT_GRANTS));
    return state.get(name)!;
  };

  for (const file of files) {
    const sql = readFileSync(`${MIGRATIONS}/${file}`, "utf8");

    // A dropped function loses its privileges; the next CREATE starts fresh.
    for (const [, name] of sql.matchAll(/DROP\s+FUNCTION\s+(?:IF\s+EXISTS\s+)?(?:public\.)?(\w+)/gi)) {
      state.delete(name);
    }
    for (const [, name] of sql.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?(\w+)\s*\(/gi)) {
      ensure(name);
    }

    // Written-out privilege statements.
    for (const [, verb, name, roles] of sql.matchAll(
      /\b(REVOKE|GRANT)\b[\s\S]{0,80}?ON\s+FUNCTION\s+(?:public\.)?(\w+)\s*\([\s\S]{0,400}?\)\s*(?:FROM|TO)\s+([^;]+);/gi,
    )) {
      const held = ensure(name);
      for (const role of roles.toLowerCase().split(",").map((r) => r.trim())) {
        if (verb.toUpperCase() === "REVOKE") held.delete(role === "public" ? "public" : role);
        else held.add(role);
      }
    }

    // The isolation migration issues its statements dynamically, over the names
    // in its own array. Model exactly what it executes.
    const dynamicRevoke = /format\('REVOKE ALL ON FUNCTION %s FROM ([^']+)'/.exec(sql);
    const dynamicGrant = /format\('GRANT EXECUTE ON FUNCTION %s TO ([^']+)'/.exec(sql);
    if (dynamicRevoke || dynamicGrant) {
      const scope = [...sql.slice(sql.indexOf("ARRAY["), sql.indexOf("];", sql.indexOf("ARRAY[")))
        .replace(/--[^\n]*/g, "").matchAll(/'(\w+)'/g)].map((m) => m[1]);
      for (const name of scope) {
        const held = ensure(name);
        for (const role of (dynamicRevoke?.[1] ?? "").toLowerCase().split(",").map((r) => r.trim())) {
          if (role) held.delete(role);
        }
        for (const role of (dynamicGrant?.[1] ?? "").toLowerCase().split(",").map((r) => r.trim())) {
          if (role) held.add(role);
        }
      }
    }
  }

  return state;
}

const grants = finalGrants();
const isolated = protectedNames();

/** Predicates that RLS policies evaluate as the querying user. */
const RLS_PREDICATES = [
  "has_role", "is_library_book_owner", "is_library_book_published", "is_kids_guardian_of",
  "is_organization_member", "can_access_library_book_content", "is_academy_course_owner",
];

/** RPCs the browser calls for real, checked against src/ below. */
const BROWSER_RPCS = [
  "match_embeddings", "spend_vx", "subscribe_tv", "subscribe_radio", "get_leaderboard",
  "award_points", "record_tv_watch", "toggle_tv_favorite", "ban_user", "admin_grant_points",
];

describe("the RPCs that must never be reachable from a browser key", () => {
  it("names 31 functions, and reads that list from the migration itself", () => {
    expect(isolated).toHaveLength(31);
    expect(new Set(isolated).size).toBe(31);
    // The two that made this urgent.
    expect(isolated).toContain("decide_owner_approval");
    expect(isolated).toContain("system_deduct_vx");
  });

  it("ends with anon and authenticated holding no EXECUTE on any of them", () => {
    for (const name of isolated) {
      const held = grants.get(name);
      expect(held, `${name} was never created in any migration`).toBeDefined();
      expect([...held!].sort(), `${name} is still reachable`).not.toContain("anon");
      expect([...held!].sort(), `${name} is still reachable`).not.toContain("authenticated");
    }
  });

  it("keeps service_role able to execute every one of them", () => {
    for (const name of isolated) {
      expect([...grants.get(name)!], `${name} lost its server-side caller`).toContain("service_role");
    }
  });

  it("starts each function where Supabase starts it, so a revoke is required", () => {
    // Without the default-grant assumption the assertions above would pass
    // vacuously. A function nobody ever revoked must therefore still show anon.
    const untouched = [...grants.entries()].find(
      ([name, held]) => !isolated.includes(name) && held.has("anon") && held.has("authenticated"),
    );
    expect(untouched, "the model must show unprotected functions as reachable").toBeDefined();
  });
});
describe("the fix is scoped, and does not reach past its list", () => {
  it("leaves every RLS predicate executable by anon and authenticated", () => {
    for (const name of RLS_PREDICATES) {
      expect(isolated, `${name} is used inside a policy and must stay callable`).not.toContain(name);
      const held = grants.get(name);
      if (!held) continue;
      expect([...held], `${name} lost authenticated`).toContain("authenticated");
    }
  });

  it("leaves the RPCs the browser really calls alone", () => {
    for (const name of BROWSER_RPCS) {
      expect(isolated, `${name} is called from the browser`).not.toContain(name);
    }
  });

  it("does not isolate anything the app calls outside tests", () => {
    const sources: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = `${dir}/${entry.name}`;
        if (entry.isDirectory()) {
          if (entry.name !== "test") walk(full);
        } else if (/\.tsx?$/.test(entry.name)) sources.push(readFileSync(full, "utf8"));
      }
    };
    walk("src");

    for (const name of isolated) {
      const called = sources.some((src) => new RegExp(`rpc\\(\\s*["'\`]${name}["'\`]`).test(src));
      expect(called, `${name} is isolated but the app calls it directly`).toBe(false);
    }
  });
});

describe("the isolation migration changes privileges and nothing else", () => {
  const sql = readFileSync(`${MIGRATIONS}/${ISOLATION_MIGRATION}`, "utf8");

  it("declares no table, function, policy, trigger or index", () => {
    for (const ddl of [
      /CREATE\s+TABLE/i, /ALTER\s+TABLE/i, /CREATE\s+(OR\s+REPLACE\s+)?FUNCTION/i,
      /CREATE\s+POLICY/i, /DROP\s+POLICY/i, /CREATE\s+TRIGGER/i, /CREATE\s+INDEX/i,
      /CREATE\s+UNIQUE\s+INDEX/i,
    ]) {
      expect(sql, `${ddl} must not appear`).not.toMatch(ddl);
    }
  });

  it("writes no data", () => {
    for (const dml of [/INSERT\s+INTO/i, /\bUPDATE\s+public\./i, /DELETE\s+FROM/i, /TRUNCATE/i]) {
      expect(sql).not.toMatch(dml);
    }
  });

  it("reads its signatures from the catalogue instead of restating them", () => {
    // A hand-written argument list that does not match would abort the deploy,
    // and would silently miss an overload.
    expect(sql).toContain("p.oid::regprocedure");
    expect(sql).toContain("FROM PUBLIC, anon, authenticated");
    expect(sql).toContain("TO service_role");
  });

  it("fails loudly on a name that matches no function", () => {
    expect(sql).toMatch(/IF _touched = 0 THEN[\s\S]{0,200}RAISE EXCEPTION/);
  });

  it("touches nothing in Phase 4, Phase 7 or Phase 8", () => {
    // Those migrations keep their own content; this one only re-grants.
    for (const phase of [
      "20260902000000_owner_control_and_escalations.sql",
      "20260904000000_ai_content_engine.sql",
      "20260905000000_social_publishing_core.sql",
    ]) {
      expect(sql).not.toContain(phase);
    }
    expect(sql).not.toContain("H3JHZ");
    expect(sql).not.toContain("ai_budgets");
  });
});
