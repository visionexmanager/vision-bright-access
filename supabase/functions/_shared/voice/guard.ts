// The live wiring for `access.ts`: real Supabase clients, real environment.
//
// Kept apart from the decision so the policy stays testable under Vitest, which
// cannot resolve a `npm:` specifier. Everything here is I/O; everything worth
// asserting about is next door.

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  decideVoiceAccess,
  type VoiceAccessResult,
} from "./access.ts";

export { refusalResponse } from "./access.ts";
export type { VoiceAccessRefusal, VoiceAccessResult } from "./access.ts";

/** Verify the caller and charge one unit of their daily voice quota. */
export async function guardVoiceRequest(
  req: Request,
  functionName: string,
): Promise<VoiceAccessResult> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const configured = Boolean(supabaseUrl && anonKey && serviceKey);
  if (!configured) {
    console.error(`[${functionName}] cannot verify the caller: Supabase env is incomplete`);
  }

  return decideVoiceAccess({
    authHeader: req.headers.get("Authorization"),
    configured,
    functionName,
    ports: {
      // The anon-key client carrying the caller's own header is what turns a
      // JWT into a user. The publishable key alone yields none, which is
      // exactly the case that used to slip through.
      async identify(authHeader) {
        const userClient = createClient(supabaseUrl!, anonKey!, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data, error } = await userClient.auth.getUser();
        if (error || !data?.user) return null;
        return { id: data.user.id };
      },

      async checkLimit(userId, name) {
        const serviceClient = createClient(supabaseUrl!, serviceKey!);
        const { data, error } = await serviceClient
          .rpc("check_ai_rate_limit", { _user_id: userId, _function_name: name });
        if (error) {
          console.error(`[${name}] quota check failed:`, error.code ?? "unknown");
          return "error";
        }
        return data !== false;
      },
    },
  });
}
