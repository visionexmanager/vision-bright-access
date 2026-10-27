import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The two token functions encrypt and decrypt with pgcrypto, which Supabase
// installs in the `extensions` schema. They were created with a search_path of
// `public` alone, so the first store failed with "function pgp_sym_encrypt does
// not exist" and every OAuth connection ended as connection=store_failed.

const dir = "supabase/migrations";
const files = readdirSync(dir).sort();

/** The last search_path any migration gave this function. */
function lastSearchPath(name: string): string | null {
  let path: string | null = null;
  for (const file of files) {
    const sql = readFileSync(`${dir}/${file}`, "utf8");
    for (const m of sql.matchAll(new RegExp(`(?:ALTER|CREATE(?: OR REPLACE)?) FUNCTION public\\.${name}\\([\\s\\S]*?SET search_path(?: TO|\\s*=)\\s*([^\\n;]+)`, "gi"))) {
      path = m[1].trim();
    }
  }
  return path;
}

describe("social token functions can see pgcrypto", () => {
  for (const name of ["store_social_account_token", "resolve_social_account_token"]) {
    it(`${name} ends with extensions on its search_path`, () => {
      expect(lastSearchPath(name)).toMatch(/\bextensions\b/);
    });
  }

  it("still pins the path to schemas that cannot be written by the caller", () => {
    for (const name of ["store_social_account_token", "resolve_social_account_token"]) {
      expect(lastSearchPath(name)).toMatch(/^public\s*,\s*extensions$/);
    }
  });
});
