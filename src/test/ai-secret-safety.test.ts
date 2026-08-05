import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");

describe("AI secret deployment safety", () => {
  it("syncs the shared OpenAI key to Supabase without placing it in frontend variables", () => {
    const workflow = readFileSync(resolve(root, ".github/workflows/deploy.yml"), "utf8");

    expect(workflow).toContain("supabase secrets set OPENAI_API_KEY=\"$OPENAI_API_KEY\"");
    expect(workflow).toContain("OPENAI_API_KEY:       ${{ secrets.OPENAI_API_KEY }}");
    expect(workflow).not.toContain("VITE_OPENAI_API_KEY");
  });

  it("does not reveal any API-key prefix through the public health check", () => {
    const healthCheck = readFileSync(
      resolve(root, "supabase/functions/health-check/index.ts"),
      "utf8",
    );

    expect(healthCheck).not.toMatch(/val\.slice\s*\(/);
    expect(healthCheck).toContain("`${name} is configured.`");
  });
});
