import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync("src/App.tsx", "utf8");
const navSource = readFileSync("src/components/academy/AcademyNav.tsx", "utf8");
const enrollmentMigration = readFileSync(
  "supabase/migrations/20260809000000_secure_academy_enrollment.sql",
  "utf8"
);
const academyLocalizedSources = [
  "src/pages/Academy.tsx",
  "src/components/academy/AcademyOnboarding.tsx",
  "src/components/academy/AcademyDashboard.tsx",
  "src/lib/academy/onboardingOptions.ts",
].map((path) => readFileSync(path, "utf8")).join("\n");
const locales = ["en", "ar", "ur", "hi", "id", "ja", "it", "ko", "nl", "pl", "vi", "bn", "fa", "es", "de", "pt", "zh", "tr", "fr", "ru"];

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

  it("defines every referenced Academy translation key in all supported locales", () => {
    const referencedKeys = new Set(
      [...academyLocalizedSources.matchAll(/["'`](academy\.[\w.]+)["'`]/g)]
        .map((match) => match[1])
        .filter((key) => !key.endsWith("."))
    );

    expect(referencedKeys.size).toBeGreaterThan(20);
    for (const locale of locales) {
      let dictionary = readFileSync(`src/i18n/${locale}.ts`, "utf8");
      try {
        dictionary += readFileSync(`src/i18n/chunks/${locale}.ts`, "utf8");
      } catch {
        // Most locale catalogs fit in one source file.
      }
      for (const key of referencedKeys) {
        expect(dictionary, `${locale} is missing ${key}`).toContain(`"${key}"`);
      }
    }
  });
});
