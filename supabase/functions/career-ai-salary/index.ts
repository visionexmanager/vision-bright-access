// POST /api/ai/salary — AI Salary Predictor.
// Input: { input: string (role, location, experience level), role?, noCache? }
import { handleStructuredCareerAiRequest } from "../_shared/careerAiHandler.ts";

Deno.serve((req) => handleStructuredCareerAiRequest(req, { service: "salary" }));
