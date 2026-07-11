# Career Center AI Layer — Architecture Reference

Real, multi-provider AI integration for VisionEx Career Center, built on top
of the existing Supabase-native backend (Phase 9 schema). No mock responses
remain in this layer — every `/api/ai/*` endpoint calls a real provider.

## Required secrets (Supabase project settings → Edge Functions → Secrets)

| Secret | Used by |
|---|---|
| `OPENAI_API_KEY` | `_shared/aiProvider.ts` (existing, shared across the whole app) |
| `ANTHROPIC_API_KEY` | `_shared/aiProvider.ts` (existing, shared across the whole app) |
| `GEMINI_API_KEY` | `_shared/geminiProvider.ts` (new — Career Center specific) |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | auto-injected by Supabase, no action needed |

Without a given provider's key, that provider is skipped and the
orchestrator falls to the next one in the fallback order; if all three are
missing/failing, endpoints return the graceful `degraded: true` fallback
response documented below instead of erroring.

## Request flow (structured endpoints)

```
Edge Function (career-ai-*)
  → authenticateCareerAiRequest()   [_shared/careerAiHandler.ts]
      - verifies JWT via anon-key client (auth.getUser())
      - applies checkRateLimit()    [_shared/careerRateLimit.ts] (20 calls / 10 min / user)
  → validateAndCleanInput()         [_shared/careerAiSafety.ts]
  → buildUserAiContext()            [_shared/careerAiMemory.ts] (profile + goals + recent AI activity)
  → getCareerAiPrompt(service, role)[_shared/careerPrompts.ts] (versioned, role-aware system prompt)
  → runStructuredCareerAI()         [_shared/careerAiOrchestrator.ts]
      - cache lookup (ai_response_cache, SHA-256 key of service+system+userText)
      - tries providers in order: openai → anthropic → gemini
      - sanitizeAiOutput() + coerceToStructuredResponse() on the winning result
      - writes cache + logs to ai_interactions
      - on total failure: returns a structured "temporarily unavailable" response, never a raw 500
```

`career-ai-chat` follows the same auth/rate-limit path but streams via
`runCareerAIChatStream()` instead (SSE, OpenAI-compatible chunk shape
regardless of provider — same convention as the site-wide `ai-chat` function).

`career-ai-match` bypasses free-text `input` and instead pulls real rows
from `jobs` and `career_profiles` (re-applying the `jobs` RLS visibility
rule manually since it runs on the service-role client).

## Endpoints → services

| Endpoint (folder) | Service | Default tier |
|---|---|---|
| `career-ai-resume` | resume | capable |
| `career-ai-analyze` | analyze | cheap |
| `career-ai-coach` | coach | capable |
| `career-ai-roadmap` | roadmap | capable |
| `career-ai-visa` | visa | capable |
| `career-ai-match` | match | cheap |
| `career-ai-salary` | salary | cheap |
| `career-ai-interview` | interview | capable |
| `career-ai-health-score` | health_score | cheap |
| `career-ai-chat` | chat (streaming) | cheap |

## Model matrix (`_shared/careerAiOrchestrator.ts`)

| Provider | cheap | capable |
|---|---|---|
| OpenAI | `gpt-4o-mini` | `gpt-4.1` |
| Anthropic | `claude-haiku-4-5-20251001` | `claude-sonnet-4-6` |
| Gemini | `gemini-2.5-flash` | `gemini-2.5-pro` |

OpenAI/Anthropic identifiers match existing conventions already used
elsewhere in `supabase/functions/`; Gemini had no prior convention in this
repo, so current well-known Gemini model IDs were used.

## Mandatory response contract

Every structured endpoint returns:

```json
{
  "summary": "",
  "recommendations": [],
  "scores": {},
  "insights": [],
  "next_steps": [],
  "meta": { "provider": "openai", "model": "gpt-4.1", "cached": false, "degraded": false, "latencyMs": 842 }
}
```

`meta` is additive (not part of the strict 5-key contract) and lets the
frontend show cache/degradation state without breaking the shape.

## Known limitation

This was built and statically verified (brace/paren balance, import
resolution, no schema drift) in an environment with no Node.js/Deno runtime
available — it has not been executed against live provider APIs. Set the
three provider secrets in the Supabase dashboard and exercise each endpoint
once before relying on it in production.
