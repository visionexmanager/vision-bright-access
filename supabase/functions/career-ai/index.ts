// Career Center AI — one endpoint, ten services.
//
// Replaces the ten career-ai-* functions, which were eight five-line wrappers
// around a single shared handler plus two with their own bodies. All ten
// already shared authenticateCareerAiRequest; only the entry point differed.
//
// Dispatch is a closed allowlist mapping a request `action` to a known
// service. It is not a lookup into a function table: an unrecognised action
// returns 400 and reaches nothing. There is no path by which a caller can name
// an arbitrary handler.
//
// Contracts are unchanged. Each action's body, auth, rate limiting and
// response shape are exactly what the corresponding function served, because
// the same handlers are called.
//
//   POST /functions/v1/career-ai   { action: "salary", input: "..." }
//
// Previously: POST /functions/v1/career-ai-salary { input: "..." }

import { getCorsHeaders } from "../_shared/cors.ts";
import { handleStructuredCareerAiRequest, json } from "../_shared/careerAiHandler.ts";
import { handleCareerAiChat } from "../_shared/careerAiChat.ts";
import { handleCareerAiMatch } from "../_shared/careerAiMatch.ts";
import type { CareerAiService } from "../_shared/careerPrompts.ts";

/**
 * The eight structured services, as an explicit action -> service map.
 *
 * Written out rather than derived so adding an action is a deliberate edit,
 * and so a value can never be attacker-supplied: the right-hand side is a
 * literal from CareerAiService, checked by the compiler.
 */
const STRUCTURED_ACTIONS: Readonly<Record<string, CareerAiService>> = Object.freeze({
  analyze: "analyze",
  coach: "coach",
  health_score: "health_score",
  interview: "interview",
  resume: "resume",
  roadmap: "roadmap",
  salary: "salary",
  visa: "visa",
});

/** Services with their own bodies rather than the generic structured path. */
const CUSTOM_ACTIONS = Object.freeze({
  chat: handleCareerAiChat,
  match: handleCareerAiMatch,
});

export const CAREER_AI_ACTIONS = Object.freeze([
  ...Object.keys(STRUCTURED_ACTIONS),
  ...Object.keys(CUSTOM_ACTIONS),
]);

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Peek at the action on a clone so the original body stays unread — every
  // downstream handler parses it itself, exactly as it did when each was its
  // own function.
  let action = "";
  try {
    const peek = await req.clone().json();
    action = typeof peek?.action === "string" ? peek.action : "";
  } catch {
    return json({ error: "A JSON body with an action is required" }, 400, corsHeaders);
  }

  // Own-property check: a plain `in` or bracket lookup would also match
  // inherited names like "constructor" or "toString".
  if (Object.prototype.hasOwnProperty.call(CUSTOM_ACTIONS, action)) {
    return CUSTOM_ACTIONS[action as keyof typeof CUSTOM_ACTIONS](req);
  }

  if (Object.prototype.hasOwnProperty.call(STRUCTURED_ACTIONS, action)) {
    return handleStructuredCareerAiRequest(req, { service: STRUCTURED_ACTIONS[action] });
  }

  // The action is echoed back deliberately — it came from the caller, and
  // naming the valid set is what makes a typo debuggable.
  return json(
    { error: `Unknown action '${action}'`, allowed: CAREER_AI_ACTIONS },
    400,
    corsHeaders,
  );
});
