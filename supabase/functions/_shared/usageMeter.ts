// The live wiring for shadow usage metering: every provider call a function
// makes is priced from `ai_price_book` and written to `ai_usage_events`.
//
// Each entry point that reaches a model calls `installUsageMetering("<its
// name>")` once at start-up. aiProvider.ts then reports every structured call,
// chain attempt and embedding here (setUsageSink). Nothing is charged: this
// records what each call cost the provider, so that a VX price can later be
// set from real numbers.
//
// The write runs under EdgeRuntime.waitUntil and never reaches the request:
// no client, an unreadable price book or a failed insert all end in silence,
// and the answer the user waits for is unchanged.
//
// Kept apart from aiProvider.ts and metering.ts because it builds a service
// client (npm:@supabase/supabase-js), which the modules Vitest imports
// directly must not pull in — the same split as chatRecorder.ts.

import { createClient } from "npm:@supabase/supabase-js@2";
import { setUsageSink } from "./usageSink.ts";
import { recordUsageEventIn, type UsageDb } from "./usageRecording.ts";

type WaitUntil = (p: Promise<unknown>) => void;
const waitUntil: WaitUntil = (p) =>
  (globalThis as { EdgeRuntime?: { waitUntil: WaitUntil } }).EdgeRuntime?.waitUntil(p);

export function installUsageMetering(functionName: string): void {
  let client: UsageDb | null = null;
  const db = (): UsageDb =>
    client ??= createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
  setUsageSink((event) => {
    try {
      waitUntil(recordUsageEventIn(db(), functionName, event).catch(() => undefined));
    } catch {
      // Metering never reaches the request.
    }
  });
}
