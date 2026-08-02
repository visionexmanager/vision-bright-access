import { AUDIO_LIBRARY } from "./audioLibrary";
import { auditAudioLibrary } from "./audioQuality";

export function createAudioQualityReport() {
  const audits = auditAudioLibrary(AUDIO_LIBRARY);
  return {
    total: audits.length,
    approved: audits.filter((item) => item.result.valid).length,
    blocked: audits.filter((item) => !item.result.valid).length,
    replacementRequired: AUDIO_LIBRARY.filter((item) => item.quality === "replacement-required").map((item) => item.id),
    audits,
  };
}
