import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync("src/App.tsx", "utf8");
const navSource = readFileSync("src/components/academy/AcademyNav.tsx", "utf8");
const enrollmentMigration = readFileSync(
  "supabase/migrations/20260809000000_secure_academy_enrollment.sql",
  "utf8"
);

describe("Academy launch integrity", () => {
  it("keeps every primary Academy navigation destination routed", () => {
    const navPaths = [...navSource.matchAll(/path: "([^"]+)"/g)].map((match) => match[1]);
    expect(navPaths.length).toBeGreaterThanOrEqual(8);

    for (const path of navPaths) {
      expect(appSource).toContain(`path="${path}"`);
    }
  });

  it("enrolls through an authenticated database function", () => {
    expect(enrollmentMigration).toContain("academy_enroll_course");
    expect(enrollmentMigration).toContain("auth.uid()");
    expect(enrollmentMigration).toContain("public.spend_vx");
    expect(enrollmentMigration).toContain("pg_advisory_xact_lock");
  });

  it("blocks direct inserts and protected-column updates", () => {
    expect(enrollmentMigration).not.toContain(
      'CREATE POLICY "academy_enrollments: student manages own"'
    );
    expect(enrollmentMigration).toContain(
      "REVOKE UPDATE ON public.academy_enrollments FROM authenticated"
    );
    expect(enrollmentMigration).not.toMatch(
      /GRANT UPDATE \([^)]*(?:user_id|course_id)/s
    );
  });
});
