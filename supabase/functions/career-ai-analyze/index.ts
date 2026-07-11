// POST /api/ai/analyze — AI Resume Analyzer (ATS score + job alignment).
// Input: { input: string (resume text, optionally with a target job description), role?, image?, noCache? }
import { handleStructuredCareerAiRequest } from "../_shared/careerAiHandler.ts";

Deno.serve((req) => handleStructuredCareerAiRequest(req, { service: "analyze" }));
