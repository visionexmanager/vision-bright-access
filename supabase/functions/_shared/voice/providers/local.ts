// The local provider, when there is a GPU to run it on.
//
// Deliberately empty of implementation. This file exists so the shape of the
// future is written down where the next person will look for it, rather than
// living only in a document:
//
//   1. Implement `SttAdapter` — provider "local", a model name, and a `keyName`
//      that is a URL rather than a secret (the service is ours; the bearer
//      token pattern from `/internal/media/` is the one to copy).
//   2. Register it in `../stt.ts`'s `ADAPTERS`, after the API providers, so it
//      is used only when they are unavailable — or before them, once the
//      baseline shows it is at least as good in the languages that matter.
//   3. Add its per-language `claim` to `../capabilities.ts`. A local model's
//      language coverage is *not* Whisper's; measure before claiming.
//
// Nothing here is installed, downloaded or benchmarked. The current server has
// no GPU, and the self-hosting audit records that adding one means moving host.

export {};
