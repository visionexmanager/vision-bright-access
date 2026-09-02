import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const guardians = readFileSync("supabase/migrations/20261006010000_ivx_guardians.sql", "utf8");
const page = readFileSync("src/pages/academy/IVXGuardians.tsx", "utf8");
const dashboard = readFileSync("src/pages/academy/IVX.tsx", "utf8");
const app = readFileSync("src/App.tsx", "utf8");
const clientApi = readFileSync("src/features/ivx/api.ts", "utf8");

function region(source: string, from: string, to?: string): string {
  const start = source.indexOf(from);
  expect(start, `marker not found: ${from}`).toBeGreaterThan(-1);
  const rest = source.slice(start);
  if (!to) return rest;
  const end = rest.indexOf(to);
  expect(end, `end marker not found: ${to}`).toBeGreaterThan(-1);
  const cut = rest.slice(0, end);
  expect(cut.length, `region ${from} → ${to} is empty`).toBeGreaterThan(20);
  return cut;
}

// ── Consent runs one way ────────────────────────────────────────────────────

describe("only a student can start a link", () => {
  it("gives the invite function no student argument to point elsewhere", () => {
    const signature = region(guardians, "FUNCTION public.ivx_guardian_invite(", ")\nRETURNS");
    expect(signature).not.toContain("_student");
    expect(signature).not.toContain("_user_id");
    expect(guardians).toContain("_student uuid := (select auth.uid());");
  });

  it("offers no way to find a student — only to redeem a code they handed over", () => {
    // If a lookup by email or name ever appears, the direction of consent has
    // been reversed and this is the test that should stop it.
    expect(guardians).not.toMatch(/FUNCTION public\.ivx_guardian_(search|find|lookup|invite_by_email)/);
    expect(page).not.toMatch(/search|lookup|by email/i);
    const accept = region(guardians, "FUNCTION public.ivx_guardian_accept(", ")\nRETURNS");
    expect(accept).toContain("_code text");
  });

  it("has no write policy, so nobody can appoint themselves", () => {
    expect(guardians).toMatch(/POLICY "ivx_guardians_own_side"[^;]*FOR SELECT/);
    expect(guardians).not.toMatch(/ON public\.ivx_guardians\s+FOR (INSERT|UPDATE|ALL)/);
    expect(guardians).toContain("GRANT SELECT ON public.ivx_guardians TO authenticated;");
    expect(guardians).not.toMatch(/GRANT (ALL|INSERT|UPDATE)[^;]*ivx_guardians TO authenticated/);
  });
});

describe("the invite code", () => {
  it("is single use, time limited, and cannot be redeemed by the student who made it", () => {
    const accept = region(guardians, "FUNCTION public.ivx_guardian_accept", "$$;");
    expect(accept).toContain("status = 'pending'");
    expect(accept).toContain("_row.invite_expires_at < now()");
    expect(accept).toContain("_row.student_user_id = _guardian");
    // Accepting clears the code, so the row can never be redeemed again.
    expect(accept).toContain("invite_code = NULL");
  });

  it("answers a wrong code and an expired code identically", () => {
    // Otherwise redemption is an oracle: try codes, and a different message
    // tells you which ones exist.
    const accept = region(guardians, "FUNCTION public.ivx_guardian_accept", "$$;");
    const reasons = [...accept.matchAll(/'reason', '([a-z_]+)'/g)].map((m) => m[1]);
    expect(new Set(reasons.filter((r) => r !== "not_authenticated"))).toEqual(new Set(["invalid_code"]));
  });

  it("avoids characters that are confused when a code is read out loud", () => {
    const alphabet = guardians.match(/substr\('([A-Z0-9]+)'/)?.[1] ?? "";
    expect(alphabet.length).toBeGreaterThan(20);
    // 0/O and 1/I/L are the pairs that get transcribed wrongly when a code is
    // spelled out, and this code exists to be spelled out.
    expect(alphabet).not.toMatch(/[01OIL]/);
    expect(guardians).toContain("generate_series(1, 10)");
    // Typed by somebody who was told it over the phone.
    expect(guardians).toContain("upper(btrim(COALESCE(_code, '')))");
  });

  it("caps how many invitations can be outstanding at once", () => {
    expect(guardians).toContain("'too_many_pending'");
    expect(guardians).toContain("IF _open >= 5 THEN");
  });

  it("keeps the generator away from every client role", () => {
    expect(guardians).toContain("REVOKE ALL ON FUNCTION public.ivx_guardian_code() FROM authenticated");
    expect(guardians).toContain("GRANT EXECUTE ON FUNCTION public.ivx_guardian_code() TO service_role");
  });
});

// ── What a guardian may see ─────────────────────────────────────────────────

describe("the guardian's view is progress and nothing else", () => {
  const projection = region(guardians, "FUNCTION public.ivx_guardian_progress", "$$;");

  it("checks the link before it reads anything", () => {
    const check = projection.indexOf("status = 'active'");
    const read = projection.indexOf("RETURN jsonb_build_object(\n    'ok', true");
    expect(check).toBeGreaterThan(-1);
    expect(check).toBeLessThan(read);
    expect(projection).toContain("'not_linked'");
  });

  it("never reaches the tutoring transcript or what the student typed", () => {
    // These are the two tables a "richer parent view" would reach for first.
    expect(projection).not.toContain("ivx_tutor_turns");
    expect(projection).not.toContain("a.given");
    expect(projection).not.toMatch(/'given'|'answer'/);
    expect(projection).not.toContain("auth.users");
  });

  it("says where help would land without quoting any working", () => {
    expect(projection).toContain("'struggling'");
    // Counts and a state, not answers.
    const struggling = region(projection, "'struggling'", "'mastered'");
    expect(struggling).toContain("m.attempts");
    expect(struggling).toContain("m.correct");
    expect(struggling).not.toContain("given");
  });

  it("shows a guardian's published Academy name, never an email address", () => {
    const links = region(guardians, "FUNCTION public.ivx_guardian_links", "$$;");
    expect(links).toContain("academy_profiles");
    // Comments in this file discuss email; the SQL must not touch it. Strip
    // the comments before asserting, or the test passes on the prose.
    const code = links.replace(/--[^\n]*/g, "");
    expect(code).not.toContain("auth.users");
    expect(code).not.toMatch(/email/i);
  });
});

describe("ending a link", () => {
  it("works from either side and is refused to everybody else", () => {
    const revoke = region(guardians, "FUNCTION public.ivx_guardian_revoke", "$$;");
    expect(revoke).toContain("(student_user_id = _me OR guardian_user_id = _me)");
    expect(revoke).toContain("'not_found'");
    // Immediate: the row changes state rather than being marked for later.
    expect(revoke).toContain("SET status = 'revoked'");
  });

  it("stops the progress call at once, because it filters on active", () => {
    const projection = region(guardians, "FUNCTION public.ivx_guardian_progress", "$$;");
    expect(projection).toContain("AND status = 'active'");
  });
});

// ── The page ────────────────────────────────────────────────────────────────

describe("the page is reachable and usable without sight", () => {
  it("is routed and linked from the dashboard", () => {
    // A registered route nobody links to is not a shipped screen.
    expect(app).toContain('path="/academy/ivx/guardians"');
    expect(app).toContain('import("./pages/academy/IVXGuardians")');
    expect(dashboard).toContain('to="/academy/ivx/guardians"');
  });

  it("announces a new code assertively and spells it out for a screen reader", () => {
    // The one assertive region on the page: it was just asked for, it is about
    // to be read down a phone, and it expires.
    expect(page).toContain('aria-live="assertive"');
    expect(page).toContain('freshCode.split("").join(" ")');
    expect(page).toContain('className="sr-only"');
  });

  it("labels every control it has", () => {
    for (const id of ["ivx-relation", "ivx-label", "ivx-code"]) {
      expect(page, id).toContain(`htmlFor="${id}"`);
      expect(page, id).toContain(`id="${id}"`);
    }
  });

  it("tells the student what a guardian will and will not see", () => {
    expect(page).toContain("never what you typed");
    expect(page).toContain("stays with them");
  });

  it("keeps the client from inventing a student to look at", () => {
    const guardianApi = region(clientApi, "export const ivxGuardians", "};");
    // `progress` names the person being looked at; nothing else takes an id,
    // and none of them takes the *caller's* id.
    expect(guardianApi).toContain("_student_id: studentId");
    expect(guardianApi).not.toContain("_guardian_user_id");
    expect(guardianApi).not.toContain("_user_id");
  });
});
