import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Two lists decide whether Meta, Stripe or a cron job can reach an Edge
// Function, and they have to agree:
//
//   supabase/config.toml                         — `functions serve` locally
//   scripts/deploy-changed-supabase-functions.sh — the flag production gets
//
// Only the second one reaches production, so a function exempted in the TOML
// and missing from the script looks configured and answers 401 to every real
// caller. Nothing compared them until a conflict resolution dropped
// `verify_jwt = false` from one side and the mismatch reached `main`.
//
// The same resolution left a bare `=======` in the TOML, which `supabase` could
// not parse — so `db push` and `functions deploy` both failed on every deploy
// until it was found. Neither the type checker nor any test reads these files,
// which is exactly why this one does.

const config = readFileSync("supabase/config.toml", "utf8");
const deployScript = readFileSync("scripts/deploy-changed-supabase-functions.sh", "utf8");

/** Function names carrying `verify_jwt = false` in config.toml. */
function exemptedInConfig(): string[] {
  const names: string[] = [];
  const lines = config.split(/\r?\n/);
  let current: string | null = null;

  for (const line of lines) {
    const section = /^\[functions\.([A-Za-z0-9_-]+)\]\s*$/.exec(line);
    if (section) {
      current = section[1];
      continue;
    }
    if (/^\[/.test(line)) current = null;
    if (current && /^\s*verify_jwt\s*=\s*false\s*$/.test(line)) {
      names.push(current);
      current = null;
    }
  }
  return names.sort();
}

/** Function names in the deploy script's NO_VERIFY_JWT map. */
function exemptedInDeployScript(): string[] {
  const block = deployScript.slice(
    deployScript.indexOf("declare -A NO_VERIFY_JWT=("),
    deployScript.indexOf(")", deployScript.indexOf("declare -A NO_VERIFY_JWT=(")),
  );
  return [...block.matchAll(/^\s*\[([A-Za-z0-9_-]+)\]=1\s*$/gm)].map((m) => m[1]).sort();
}

describe("the two verify_jwt lists", () => {
  it("never exempt a function locally that production still guards", () => {
    // Deliberately one-directional. The script may exempt more — the library
    // and TV webhooks are in it and not in the TOML, because the TOML only
    // drives `functions serve` — but the reverse is a trap: a function
    // exempted in the TOML and missing from the script works on a laptop and
    // answers 401 to Meta in production.
    const script = new Set(exemptedInDeployScript());
    for (const name of exemptedInConfig()) {
      expect(script.has(name), `${name} is exempt in config.toml but not in the deploy script`).toBe(true);
    }
  });

  it("is not empty, so neither reader can pass by finding nothing", () => {
    expect(exemptedInConfig().length).toBeGreaterThan(5);
  });

  it("exempts only functions that actually exist", () => {
    const present = new Set(
      readdirSync("supabase/functions", { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name !== "_shared")
        .map((entry) => entry.name),
    );
    for (const name of exemptedInDeployScript()) {
      expect(present.has(name), `${name} is exempted but has no function directory`).toBe(true);
    }
  });

  it("still exempts the endpoints that outside callers reach without a JWT", () => {
    // These are the ones whose breakage is silent: the caller is Meta or a
    // scheduler, and a 401 looks to them like nothing happened.
    for (const name of ["whatsapp-webhook", "meta-messaging-webhook", "social-oauth"]) {
      expect(exemptedInDeployScript(), `${name} must stay exempt`).toContain(name);
    }
  });
});

describe("config.toml stays machine-readable", () => {
  it("carries no merge conflict markers", () => {
    // `supabase db push` answers "Invalid TOML document" and the whole deploy
    // fails — migrations and functions both.
    for (const [label, text] of [["config.toml", config], ["deploy script", deployScript]] as const) {
      expect(text, `${label} contains a conflict marker`).not.toMatch(/^(<{7} |={7}\r?$|>{7} )/m);
    }
  });

  it("gives every [functions.*] section a body", () => {
    // A section header immediately followed by another header means a setting
    // was lost — which is how social-publish ended up exempt in one list only.
    const lines = config.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (!/^\[functions\.[A-Za-z0-9_-]+\]\s*$/.test(lines[i])) continue;
      const next = lines.slice(i + 1).find((line) => line.trim() !== "");
      expect(next, `${lines[i]} has no settings after it`).toBeDefined();
      expect(next!, `${lines[i]} is immediately followed by another section`).not.toMatch(/^\[/);
    }
  });
});
