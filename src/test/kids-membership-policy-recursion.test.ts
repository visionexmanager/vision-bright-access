import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// The behaviour of this migration was verified by executing every migration in
// PGlite and exercising the policies as anonymous, outsider, member, moderator
// and owner (see the migration header). This file pins the shape that made the
// difference, so a later edit cannot quietly reintroduce the loop.

const sql = readFileSync(
  resolve(__dirname, "../../supabase/migrations/20261016000000_kids_membership_policy_recursion.sql"),
  "utf8",
).replace(/\r\n/g, "\n");

const MEMBERSHIP = ["kids_social_group_members", "kids_voice_room_members", "kids_multiplayer_room_players"];

const policies = [...sql.matchAll(/CREATE POLICY "([^"]+)"\s+ON public\.(\w+) FOR (\w+)([\s\S]*?);\n/g)].map(
  ([, name, table, command, body]) => ({ name, table, command, body }),
);

describe("kids membership policies", () => {
  it("rewrites every policy that used to loop", () => {
    expect(policies.length).toBe(23);
    for (const policy of policies) {
      expect(sql, `${policy.name} must replace the old policy of the same name`).toContain(
        `DROP POLICY IF EXISTS "${policy.name}" ON public.${policy.table};`,
      );
    }
  });

  it("never queries a membership table from inside a policy", () => {
    for (const policy of policies) {
      for (const table of MEMBERSHIP) {
        expect(policy.body, `${policy.name} reads ${table} directly`).not.toMatch(new RegExp(`FROM public\\.${table}\\b`));
      }
    }
  });

  it("asks the membership question only about the caller", () => {
    const helpers = [...sql.matchAll(/CREATE OR REPLACE FUNCTION public\.(kids_\w+)\(([^)]*)\)[\s\S]*?\$\$([\s\S]*?)\$\$/g)];
    expect(helpers.map(([, name]) => name).sort()).toEqual(
      ["kids_am_multiplayer_player", "kids_my_group_role", "kids_my_voice_room_role"],
    );
    for (const [, name, args, body] of helpers) {
      expect(args.split(",").length, `${name} must not take a user id`).toBe(1);
      expect(body, `${name} must answer for auth.uid()`).toMatch(/user_id\s*= auth\.uid\(\)/);
    }
    expect(sql.match(/SECURITY DEFINER\nSET search_path = public/g)).toHaveLength(3);
  });

  it("lets the roles that evaluate policies call the helpers, and nobody else", () => {
    for (const name of ["kids_my_group_role", "kids_my_voice_room_role", "kids_am_multiplayer_player"]) {
      expect(sql).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${name}\\(uuid\\)\\s+FROM PUBLIC;`));
      expect(sql).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${name}\\(uuid\\)\\s+TO anon, authenticated, service_role;`));
    }
  });

  it("keeps moderation to owners and moderators", () => {
    const moderation = policies.filter((p) => /manage|deletes|removes|updates own row/.test(p.name) && p.body.includes("kids_my_"));
    expect(moderation.length).toBeGreaterThan(0);
    for (const policy of moderation) {
      expect(policy.body, `${policy.name} must not let any member moderate`).not.toMatch(/kids_my_(group|voice_room)_role\([^)]*\) IS NOT NULL/);
    }
  });
});
