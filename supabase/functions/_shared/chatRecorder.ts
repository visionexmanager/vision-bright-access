// The live wiring for recording chat and vision attempts in the provider
// registry (Phase 2K-4). Each entry point whose requests reach the two
// fallback loops in `aiProvider.ts` calls `installChatAttemptRecording()` once
// at start-up; the loops then report every attempt here.
//
// Kept apart from `aiProvider.ts` and `providerRecording.ts` because it builds
// a service client, which needs `npm:@supabase/supabase-js` — something the
// modules the test suite imports directly must not pull in (as ttsRecorder.ts).

import { createClient } from "npm:@supabase/supabase-js@2";
import { setProviderAttemptRecorder } from "./aiProvider.ts";
import { recordProviderAttempt, type RecordingDb } from "./providerRecording.ts";

/**
 * Record each attempt without holding up the response: the write runs under
 * `EdgeRuntime.waitUntil`, and any failure — building the client, the registry
 * lookup, the insert — is swallowed. The client is made once, on the first
 * attempt, and reused.
 */
export function installChatAttemptRecording(): void {
  let client: RecordingDb | null = null;
  setProviderAttemptRecorder((attempt) => {
    try {
      client ??= createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      );
      const work = recordProviderAttempt(client, attempt).catch(() => undefined);
      (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime?.waitUntil(work);
    } catch {
      // Telemetry never reaches the request.
    }
  });
}
