// POST /api/ai/chat — the one streaming Career Center AI endpoint (no fixed
// JSON schema; a live conversational assistant). Auth + rate-limit follow
// the same shared path as the structured endpoints; the response is an
// OpenAI-compatible SSE stream regardless of which provider served it.
import { getCorsHeaders } from "../_shared/cors.ts";
import { authenticateCareerAiRequest, json } from "../_shared/careerAiHandler.ts";
import { CareerAIAllProvidersFailedError, runCareerAIChatStream } from "../_shared/careerAiOrchestrator.ts";
import { CareerAiRole, getCareerChatPrompt } from "../_shared/careerPrompts.ts";
import { buildUserAiContext } from "../_shared/careerAiMemory.ts";
import { validateAndCleanInput } from "../_shared/careerAiSafety.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await authenticateCareerAiRequest(req);
  if (!auth.ok) return auth.response;
  const { user, serviceClient, body } = auth.value;

  try {
    const messages = Array.isArray(body.messages) ? body.messages : null;
    if (!messages || messages.length === 0) {
      return json({ error: "messages array is required" }, 400, corsHeaders);
    }

    const lastUserMessage = [...messages].reverse().find((m) => m?.role !== "assistant");
    const validation = validateAndCleanInput(typeof lastUserMessage?.content === "string" ? lastUserMessage.content : "");
    if (!validation.ok) return json({ error: validation.reason }, 400, corsHeaders);

    const role: CareerAiRole = body.role === "employer" || body.role === "mentor" ? body.role : "candidate";
    const memoryContext = await buildUserAiContext(serviceClient, user.id);
    let system = getCareerChatPrompt(role);
    if (memoryContext.contextText) {
      system += `\n\n## Known user context\n${memoryContext.contextText}`;
    }

    const cleanMessages = messages.map((m: { role: string; content: string }) => ({
      role: m.role === "assistant" ? "assistant" as const : "user" as const,
      content: m.content,
    }));

    const { stream } = await runCareerAIChatStream({ system, messages: cleanMessages });

    // Best-effort usage log; the stream itself isn't buffered to compute
    // exact token counts without breaking streaming, so this call is fire-
    // and-forget from the orchestrator's own logging inside structured
    // calls — chat logs a lightweight marker row here instead.
    serviceClient.from("ai_interactions").insert({
      user_id: user.id,
      service: "chat",
      provider: "stream",
      model: "stream",
      cache_hit: false,
      request_summary: validation.cleaned.slice(0, 300),
    }).then(() => {}, (err: unknown) => console.error("Failed to log chat interaction:", err));

    return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    if (e instanceof CareerAIAllProvidersFailedError) {
      return json({ error: "AI service temporarily unavailable. Please try again shortly." }, 503, corsHeaders);
    }
    console.error("career-ai-chat error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500, corsHeaders);
  }
});
