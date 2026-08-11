import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Edge functions are Deno sources. tsconfig excludes them, so `tsc -b` never
// resolves their imports, and a unit test only covers a module something
// actually imports. A relative path that points at nothing therefore reaches
// the deploy, where `supabase functions deploy` fails with the unhelpful
// "failed to create the graph" — which is exactly what happened to
// ai-source-products on 2026-08-12.
//
// This walks every relative import in supabase/functions and checks the target
// exists.

const ROOT = "supabase/functions";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith(".ts") ? [full] : [];
  });
}

/** Relative specifiers only — npm:, jsr:, https: and bare ones are the CLI's job. */
function relativeImports(source: string): string[] {
  const specifiers: string[] = [];
  const patterns = [
    /\bfrom\s+["'](\.[^"']+)["']/g,
    /\bimport\s+["'](\.[^"']+)["']/g,
    /\bimport\s*\(\s*["'](\.[^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) specifiers.push(match[1]);
  }
  return specifiers;
}

describe("edge function imports resolve", () => {
  const files = sourceFiles(ROOT);

  it("finds the function sources", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("every relative import points at a file that exists", () => {
    const broken: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const specifier of relativeImports(source)) {
        const target = resolve(dirname(file), specifier);
        if (!existsSync(target)) {
          broken.push(`${file} -> ${specifier}`);
        }
      }
    }

    expect(broken, `unresolvable imports:\n${broken.join("\n")}`).toEqual([]);
  });

  it("the adapter reaches the shared provider two levels up", () => {
    // The specific regression: one ".." pointed inside sourcing/ instead of
    // at _shared/.
    const adapter = readFileSync(`${ROOT}/_shared/sourcing/adapters/visionexCatalog.ts`, "utf8");
    expect(adapter).toContain('from "../../aiProvider.ts"');
    expect(adapter).not.toMatch(/from "\.\.\/aiProvider\.ts"/);
  });

  it("JSON imports carry the type attribute Deno requires", () => {
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/\bfrom\s+["'][^"']+\.json["']([^;\n]*)/g)) {
        expect(match[1], `${file} imports JSON without a type attribute`).toMatch(/with\s*\{\s*type:\s*["']json["']\s*\}/);
      }
    }
  });
});
