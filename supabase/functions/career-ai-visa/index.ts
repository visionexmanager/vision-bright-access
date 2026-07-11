// POST /api/ai/visa — AI Visa & Relocation Assistant.
// Input: { input: string (current country, target country, visa situation), role?, noCache? }
import { handleStructuredCareerAiRequest } from "../_shared/careerAiHandler.ts";

Deno.serve((req) => handleStructuredCareerAiRequest(req, { service: "visa" }));
