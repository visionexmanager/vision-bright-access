// The live wiring for recording text-to-speech in the provider registry
// (Phase 2K-1). `voice/tts.ts` calls a caller's `record` after a successful
// synthesis; the callers hand it this.
//
// Kept apart from `providerRecording.ts` because it builds a service client,
// which needs `npm:@supabase/supabase-js` — something the modules the test
// suite imports directly (whatsappVoiceReply.ts among them) must not pull in.
// Callers that already hold a service client pass it; the others get one made
// here, only when there is something to record.

import { createClient } from "npm:@supabase/supabase-js@2";
import type { TtsExecution } from "./voice/tts.ts";
import { recordTtsExecution, type RecordingDb } from "./providerRecording.ts";

/**
 * Record one successful synthesis without holding up the response: the write
 * runs under `EdgeRuntime.waitUntil`, and any failure — building the client,
 * the registry lookup, the insert — is swallowed.
 */
export function recordTtsInBackground(execution: TtsExecution, db?: RecordingDb): void {
  try {
    const client = db ?? createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const work = recordTtsExecution(client, execution).catch(() => undefined);
    (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime?.waitUntil(work);
  } catch {
    // Telemetry never reaches the request.
  }
}
