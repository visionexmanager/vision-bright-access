# Layla AI — standalone Alexa backend

This directory is an independent Supabase project scaffold for the Layla Alexa Custom Skill. It is outside Visionex's existing `supabase/` project and is never included in the Visionex deploy workflow.

## Architecture

- Supabase Edge Function: `layla-assistant`
- Gemini model: `gemini-flash-lite-latest` (alias, so a retired version cannot 404 again), called server-side using `GEMINI_API_KEY`
- Alexa authentication: ASK signature/certificate verifier, timestamp verifier, and exact `ALEXA_SKILL_ID` match
- Session context: latest eight user/assistant messages in Alexa session attributes only
- Limits: 64 KiB request body, 1,200 characters per prompt/history message, 320 output tokens, 15 user turns per session
- No Visionex database, tables, migrations, shared provider code, or secrets are used

The endpoint uses Alexa's built-in speech renderer. Fish Audio playback is not implemented in this phase.

## Create and configure the separate Supabase project

Create a new Supabase project named `layla-alexa-assistant` in the Supabase dashboard. Keep its project reference separate from Visionex. No database schema or migrations are required for this function.

After creating it, add these GitHub Actions repository secrets:

| Secret | Value |
|---|---|
| `LAYLA_SUPABASE_ACCESS_TOKEN` | Supabase personal access token |
| `LAYLA_SUPABASE_PROJECT_REF` | New Layla project reference |
| `LAYLA_GEMINI_API_KEY` | Gemini API key for Layla |
| `LAYLA_ALEXA_SKILL_ID` | Alexa Custom Skill ID |

Do not put Gemini keys in the Alexa Developer Console or commit them to this repository.

## Deploy

Run the GitHub Actions workflow named **Deploy Layla (manual)** using workflow_dispatch. It deploys only `layla-assistant` to `LAYLA_SUPABASE_PROJECT_REF`, sets the two function secrets, and uses `--no-verify-jwt` because Alexa cannot send a Supabase JWT. The function itself fails closed unless the Alexa signature, timestamp, and Skill ID are valid.

Endpoint after deployment:

`https://<LAYLA_SUPABASE_PROJECT_REF>.supabase.co/functions/v1/layla-assistant`

## Alexa setup

1. Create a Custom Skill in the Amazon Developer Console.
2. Import `layla/alexa/interaction-model.en-US.json`, build the model, and copy the Skill ID.
3. Set the HTTPS endpoint above as the skill endpoint.
4. Test launch, AskLaylaIntent, help, stop, session continuation, and rejection of unsigned requests in the Alexa simulator.
5. Test on the Echo Dot before publishing. Alexa's locale controls speech recognition; Lebanese Arabic recognition is not guaranteed by this en-US starter model.

## Local validation

```sh
deno test --allow-env layla/supabase/functions/layla-assistant
deno check --no-lock --node-modules-dir=none layla/supabase/functions/layla-assistant/index.ts
```

No deploy is automatic. The workflow is manual-only and never targets the Visionex Supabase project.
