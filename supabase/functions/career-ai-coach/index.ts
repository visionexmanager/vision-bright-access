// POST /api/ai/coach — AI Career Coach.
// Input: { input: string (the user's question or situation), role?, noCache? }
import { handleStructuredCareerAiRequest } from "../_shared/careerAiHandler.ts";

Deno.serve((req) => handleStructuredCareerAiRequest(req, { service: "coach" }));
