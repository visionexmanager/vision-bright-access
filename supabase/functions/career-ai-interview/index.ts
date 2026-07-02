// POST /api/ai/interview — AI Interview Simulator.
// Input: { input: string (target role for question generation, or "Q: ... A: ..." to evaluate an answer), role?, noCache? }
import { handleStructuredCareerAiRequest } from "../_shared/careerAiHandler.ts";

Deno.serve((req) => handleStructuredCareerAiRequest(req, { service: "interview" }));
