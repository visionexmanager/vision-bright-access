// POST /api/ai/health-score — AI Career Health Score.
// Input: { input?: string (optional extra context), role?, noCache? }
// Pulls the candidate's own profile/goals automatically via the shared
// memory context, so `input` can be a short free-text note or left empty.
import { handleStructuredCareerAiRequest } from "../_shared/careerAiHandler.ts";

Deno.serve((req) => handleStructuredCareerAiRequest(req, { service: "health_score" }));
