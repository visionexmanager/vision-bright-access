import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// whatsappUnderstand.ts imports Deno-only modules, so its chains are read from source.
const understand = readFileSync("supabase/functions/_shared/whatsappUnderstand.ts", "utf8");
const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");

function chain(name: string): string[] {
  const start = understand.indexOf(`export const ${name}`);
  const block = understand.slice(start, understand.indexOf("];", start));
  return [...block.matchAll(/model: "([^"]+)"/g)].map((m) => m[1]);
}

describe("describe mode leads with the stronger vision model", () => {
  it("puts gpt-4.1 first and keeps the whole existing chain behind it", () => {
    expect(understand).toMatch(/DESCRIBE_TARGETS: ProviderTarget\[\] = \[\s*\{ provider: "openai", model: "gpt-4\.1" \},\s*\.\.\.VISION_TARGETS,\s*\];/);
  });

  it("leaves the shared vision chain unchanged", () => {
    expect(chain("VISION_TARGETS")).toEqual(["gpt-4o-mini", "gemini-flash-latest", "gemini-flash-lite-latest"]);
  });

  it("picks the chain per photo only for describe, never for report explanation or other modes", () => {
    expect(webhook).toContain(
      'targets: (!mode || mode === "describe") && !explainReportImage ? describeTargetsFor(incoming.media.caption) : undefined',
    );
  });

  it("uses the cheap chain by default and the stronger one when detail is asked for", () => {
    expect(understand).toMatch(/return DETAIL_WORDS\.test\(caption \?\? ""\) \? DESCRIBE_TARGETS : VISION_TARGETS;/);
    for (const word of ["detail", "بالتفصيل", "تفصيل", "everything"]) expect(understand).toContain(word);
  });

  it("states the cost next to the choice", () => {
    expect(understand).toMatch(/\$2\.00 in \/ \$8\.00 out/);
    expect(understand).toMatch(/\$0\.15 in \/ \$0\.60 out/);
  });
});
