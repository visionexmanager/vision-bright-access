import type { AudioAssetDefinition } from "./types";

export interface AudioQualityResult { valid: boolean; errors: string[]; warnings: string[] }

export function validateAudioAsset(asset: AudioAssetDefinition): AudioQualityResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (asset.licenseStatus !== "approved") errors.push("License is not approved");
  if (asset.quality !== "production") errors.push("Asset is not production quality");
  if (!asset.sources.length) errors.push("No audio source is registered");
  if (!asset.sourceAttribution.trim()) errors.push("Source attribution is missing");
  if (!asset.license.trim()) errors.push("License metadata is missing");
  if (asset.sources.some((source) => source.sampleRateHz && source.sampleRateHz < 44_100)) errors.push("Sample rate is below 44.1 kHz");
  if (asset.sources.some((source) => source.bitrateKbps && source.codec !== "wav" && source.bitrateKbps < 160)) warnings.push("Compressed source is below 160 kbps");
  if (asset.normalizedLufs === undefined) warnings.push("LUFS target is not documented");
  return { valid: errors.length === 0, errors, warnings };
}

export function auditAudioLibrary(library: readonly AudioAssetDefinition[]) {
  return library.map((asset) => ({ asset, result:validateAudioAsset(asset) }));
}
