// The live wiring for recording chat and vision attempts in the provider
// registry (Phase 2K-4). Each entry point whose requests reach the two
// fallback loops in `aiProvider.ts` calls `installChatAttemptRecording()` once
// at start-up; the loops then report every attempt here.
//
// Kept apart from `aiProvider.ts` and `providerRecording.ts` because it builds
// a service client, which needs `npm:@supabase/supabase-js` — something the
// modules the test suite imports directly must not pull in (as ttsRecorder.ts).

import { createClient } from "npm:@supabase/supabase-js@2";
import { setProviderAttemptRecorder, setProviderRegistryView } from "./aiProvider.ts";
import { recordProviderAttempt, registryViewFrom, type RecordingDb } from "./providerRecording.ts";

type WaitUntil = (p: Promise<unknown>) => void;
const waitUntil: WaitUntil = (p) =>
  (globalThis as { EdgeRuntime?: { waitUntil: WaitUntil } }).EdgeRuntime?.waitUntil(p);

/**
 * Record each attempt without holding up the response: the write runs under
 * `EdgeRuntime.waitUntil`, and any failure — building the client, the registry
 * lookup, the insert — is swallowed. The client is made once and reused.
 *
 * The same call closes the loop the other way: the chains read back the health
 * these attempts write, from a snapshot refreshed in the background at most
 * once a minute (`registryViewFrom`). A registry that cannot be read leaves
 * every chain in its policy order.
 */
export function installChatAttemptRecording(): void {
  let client: RecordingDb | null = null;
  const db = (): RecordingDb =>
    client ??= createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
  setProviderAttemptRecorder((attempt) => {
    try {
      const work = recordProviderAttempt(db(), attempt).catch(() => undefined);
      waitUntil(work);
    } catch {
      // Telemetry never reaches the request.
    }
  });
  try {
    setProviderRegistryView(registryViewFrom(db(), { background: waitUntil }));
  } catch {
    // No client, no registry reading: the chains keep their policy order.
  }
}
