// POST /api/ai/resume — AI Resume Builder / Resume Engine.
// Input: { input: string (resume draft or raw career details), role?, image?, noCache? }
import { handleStructuredCareerAiRequest } from "../_shared/careerAiHandler.ts";

Deno.serve((req) => handleStructuredCareerAiRequest(req, { service: "resume" }));
