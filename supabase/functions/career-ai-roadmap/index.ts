// POST /api/ai/roadmap — AI Career Roadmap Generator.
// Input: { input: string (target role/goal + current situation), role?, noCache? }
import { handleStructuredCareerAiRequest } from "../_shared/careerAiHandler.ts";

Deno.serve((req) => handleStructuredCareerAiRequest(req, { service: "roadmap" }));
