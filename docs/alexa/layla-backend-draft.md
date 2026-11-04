# Layla AI — Alexa backend draft

This branch adds an isolated Supabase Edge Function for an Alexa Custom Skill. It does not replace Alexa, change the wake word, modify existing Visionex assistant routes, or deploy anything.

## Runtime design

- Endpoint after deployment: `https://nnyxtaftwispowolajpl.supabase.co/functions/v1/layla-assistant`
- Supabase gateway JWT verification is disabled only for this endpoint because Alexa cannot send a Supabase user JWT.
- The function fails closed unless it verifies Alexa's signing certificate, exact raw-body signature, request timestamp, and configured `ALEXA_SKILL_ID`.
- Gemini is called server-side through the existing `geminiStreamChatCompletion` adapter using `GEMINI_API_KEY`.
- Conversation context is held only in Alexa session attributes (latest eight messages), not Visionex user tables.
- Each Alexa session is capped at 15 user turns; prompt and response sizes are bounded.
- No API key is sent to the Echo device or returned to Alexa.

## Voice and language limitations

The first draft uses Alexa's built-in speech renderer. Fish Audio is not yet connected to the response path: custom MP3 playback needs a separate short-lived audio hosting/AudioPlayer flow and Echo hardware testing. The code does not claim a Lebanese female Fish Audio voice is active.

The starter interaction model is `en-US`. Gemini is prompted to answer in natural Lebanese Arabic, but speech recognition is controlled by Alexa's locale and device language. Lebanese Arabic is not a separate Alexa locale; recognition must be tested on the actual Echo Dot before promising hands-free Lebanese conversation.

## Setup after review and merge

1. Create an Alexa Custom Skill in the Amazon Developer Console.
2. Import `docs/alexa/layla-en-US-interaction-model.json`, build the model, and copy the Skill ID.
3. Add a GitHub repository Actions secret named `ALEXA_SKILL_ID` containing that exact ID. Never put API keys in the Alexa console.
4. A normal successful production deployment syncs the optional skill ID to Supabase. The existing deploy workflow already syncs `GEMINI_API_KEY`; this branch only adds `ALEXA_SKILL_ID` to that sync list.
5. Set the Alexa HTTPS endpoint to `https://nnyxtaftwispowolajpl.supabase.co/functions/v1/layla-assistant`.
6. Test launch, question/answer, help, stop, session continuation, and signature rejection in the Alexa simulator and on the Echo Dot before publishing.

## Validation

```sh
deno test --allow-env supabase/functions/layla-assistant
deno check supabase/functions/layla-assistant/index.ts
```

Protocol unit tests cover slot extraction, skill ID extraction, bounded session history, and response shape. This draft has not been deployed or called against a live Alexa skill. The npm ASK verifier import must pass Deno/Supabase runtime validation before production deployment.

## Explicit non-goals

- No changes to `ai-chat`, `ai-voice-chat`, WhatsApp, billing, or other user-facing Visionex flows.
- No database migrations or persistent transcript storage.
- No secret values or account credentials committed to Git.
- No merge to `main`, Supabase deployment, or production invocation.
