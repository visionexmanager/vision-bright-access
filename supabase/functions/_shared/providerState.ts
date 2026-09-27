// Providers parked out of live routing whatever secrets are present.
//
// Each of these used to switch itself on the moment its secret appeared: Career
// AI and news-generate called Anthropic whenever ANTHROPIC_API_KEY existed,
// image-tools called Replicate, Video Studio and the owner's /video called Luma,
// and voice cloning and TTS called ElevenLabs. A key is a credential, not a
// production approval. So these stay parked until someone has smoke-tested the
// provider and deleted its line here, deliberately, in a reviewed change.
//
// The providers whose switch is already explicit are not listed, because they
// cannot come on by accident: FAL and OpenRouter need their `ph_providers` row
// active AND production_eligible; RunPod needs RUNPOD_ENABLED and an endpoint;
// NVIDIA NIM and Bytez have no code path at all.
//
// A parked provider keeps its adapter, its registry row and its secrets. Only
// the selection points consult this list — the adapters do not, so their own
// tests keep proving they work for the day they are switched back on.

export const PARKED_PROVIDERS: ReadonlyMap<string, string> = new Map([
  ["anthropic", "no production credential and no smoke test (Phase 0, 2026-09-27)"],
  ["replicate", "no REPLICATE_API_TOKEN and no smoke test (Phase 0, 2026-09-27)"],
  ["luma", "no LUMA_API_KEY and no clip ever generated here (Phase 0, 2026-09-27)"],
  ["elevenlabs", "no ELEVENLABS_API_KEY; voice cloning runs on Mistral Voxtral (Phase 0, 2026-09-27)"],
]);

/** Why this provider is parked, or null when it may be selected. */
export function parkedProviderReason(provider: string): string | null {
  return PARKED_PROVIDERS.get(provider) ?? null;
}
