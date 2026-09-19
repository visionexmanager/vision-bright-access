// Three layers, and the boundaries between them.
//
//   providerRouter  — chooses a provider. Knows no billing.
//   _shared/vx/*    — reserves, runs, settles. Knows no provider.
//   the adapter     — speaks one vendor's dialect. Knows neither.
//
// Each of these is a property that would be easy to lose in one careless
// import, and losing it is how a chat outage and a media outage end up on the
// same switch, or how a price change starts needing a deploy.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Comments are stripped before every "must not contain" check. These files
// explain at length what they deliberately do NOT know about, and asserting
// against that prose tests the documentation rather than the code.
const read = (path: string) => readFileSync(path, "utf8");
const code = (path: string) =>
  readFileSync(path, "utf8").split("\n")
    .filter((line) => {
      const t = line.trimStart();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");

const meter = code("supabase/functions/_shared/vx/meter.ts");
const types = code("supabase/functions/_shared/vx/types.ts");
const waBilling = code("supabase/functions/_shared/vx/whatsapp.ts");
const router = code("supabase/functions/_shared/providerRouter.ts");
const routerText = read("supabase/functions/_shared/providerRouter.ts");
const aiProvider = code("supabase/functions/_shared/aiProvider.ts");

const VENDORS = [
  "openai", "anthropic", "gemini", "groq", "mistral", "elevenlabs",
  "luma", "replicate", "runpod", "hetzner", "sora", "whisper",
];

describe("the meter knows nothing about who does the work", () => {
  it("names no vendor, in any of the three billing modules", () => {
    for (const source of [meter, types, waBilling]) {
      for (const vendor of VENDORS) {
        // String.raw, because `\b` inside an ordinary template literal is a
        // backspace character rather than a word boundary — which made this
        // guard match nothing at all on its first run.
        expect(source.toLowerCase(), vendor).not.toMatch(new RegExp(String.raw`\b${vendor}\b`));
      }
    }
  });

  it("imports no provider code and no endpoint", () => {
    expect(meter).not.toMatch(/from "\.\.\/(aiProvider|geminiProvider|providerRouter)/);
    expect(meter).not.toMatch(/https?:\/\//);
    expect(waBilling).not.toMatch(/https?:\/\//);
    // `provider` is carried through as an opaque label for the record, which
    // is the one thing the meter may know about a vendor: its name, after the
    // fact, for the admin view.
    expect(meter).toContain("provider?: string");
  });

  it("takes the work as a promise, so a future target changes nothing here", () => {
    expect(meter).toContain("run: () => Promise<Outcome<T>>");
  });

  it("stays free of Deno entirely, so the app's build can import it", () => {
    // Not even a guarded read. These three are imported by the app's
    // TypeScript project, and anything touching Deno's globals drags them into
    // the build for everything else — the reason whatsappAsk.ts and
    // whatsappAskProvider.ts are two files rather than one.
    for (const source of [meter, types, waBilling]) {
      expect(source).not.toMatch(/\bDeno\b/);
    }
  });
});

describe("the provider router knows nothing about billing", () => {
  it("names no VX concept", () => {
    for (const billing of ["vx_reserve", "vx_settle", "vx_release", "reserved_vx",
                           "central_pricing_registry", "user_points", "credit_wallets"]) {
      expect(router, billing).not.toContain(billing);
    }
  });

  it("no longer claims importers that do not exist", () => {
    // The old header named speech-generate, voice-studio and video-studio.
    // None of them imported it, which read as an invariant and was not one.
    // The first line used to be that claim. It is now what the file is for.
    const firstLine = routerText.split("\n")[0].trim();
    expect(firstLine).toMatch(/^\/\/ Provider selection/);
    expect(firstLine).not.toMatch(/imported by/);
    // The sentence wraps across two comment lines in the source.
    expect(routerText).toContain("it has been dead since it was");
  });

  it("references no RunPod row, secret or endpoint", () => {
    expect(router).not.toContain("RUNPOD_API_KEY");
    expect(router).not.toMatch(/runpod\.(io|ai)/i);
  });
});

describe("text and media routing stay on separate switches", () => {
  it("leaves aiProvider as the chat layer, untouched by the router", () => {
    expect(aiProvider).not.toContain("ph_providers");
    expect(aiProvider).not.toContain("providerRouter");
    expect(aiProvider).not.toContain("RUNPOD");
    // The five chat providers are still exactly the five.
    expect(aiProvider).toContain(`export type AIProvider = "openai" | "anthropic" | "gemini" | "groq" | "mistral";`);
  });
});

describe("no RunPod anything exists yet", () => {
  it("is absent from the deploy secret sync and from every shared module", () => {
    const deploy = read(".github/workflows/deploy.yml");
    expect(deploy).not.toContain("RUNPOD");
    for (const source of [meter, types, waBilling, router, aiProvider]) {
      expect(source).not.toMatch(/RUNPOD/i);
    }
  });
});
