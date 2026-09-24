// The one Deno API the edge modules that tests import directly use:
// `aiProvider.ts` and `geminiProvider.ts` read their keys through
// `Deno.env.get` at call time. Tests stub it (`vi.stubGlobal("Deno", …)`); this
// only lets `tsc -b` type-check those files as part of the test program.
// Deliberately narrow — nothing else of Deno is declared.

declare const Deno: {
  env: { get(key: string): string | undefined };
};
