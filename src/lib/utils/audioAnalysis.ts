// Client-side audio analysis using the Web Audio API
import type { AudioAnalysisResult } from "@/lib/types/voice-studio";
import { DATASET_CONSTRAINTS } from "@/lib/types/voice-studio";

/**
 * Compute RMS amplitude from a Float32Array channel.
 */
function computeRms(buffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
  return Math.sqrt(sum / buffer.length);
}

/**
 * Very rough SNR estimate: ratio of speech RMS to silence-floor RMS.
 * Real SNR measurement needs voice-activity detection, so we use
 * the ratio of the top-10% loudest frames vs the bottom-10% quiet frames.
 */
function estimateSnr(channelData: Float32Array): number {
  const frameSize = 1024;
  const frames: number[] = [];
  for (let i = 0; i + frameSize < channelData.length; i += frameSize) {
    frames.push(computeRms(channelData.slice(i, i + frameSize)));
  }
  if (frames.length < 10) return 20; // not enough data, assume acceptable

  const sorted = [...frames].sort((a, b) => a - b);
  const p10 = sorted[Math.floor(sorted.length * 0.1)];
  const p90 = sorted[Math.floor(sorted.length * 0.9)];
  if (p10 < 1e-6) return 40; // very quiet floor = probably clean

  const snr = 20 * Math.log10(p90 / p10);
  return Math.max(0, Math.min(60, snr));
}

/**
 * Decode an audio file and analyse quality metrics.
 * Returns an AudioAnalysisResult with scores and human-readable feedback.
 */
export async function analyzeAudioFile(file: File): Promise<AudioAnalysisResult> {
  const issues: string[]      = [];
  const suggestions: string[] = [];

  // ── Decode ───────────────────────────────────────────────────────────────────
  let audioBuffer: AudioBuffer;
  try {
    const arrayBuffer = await file.arrayBuffer();
    const ctx = new OfflineAudioContext(1, 1, 44100);
    audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  } catch {
    return {
      durationSec:    0,
      sampleRate:     0,
      channels:       0,
      estimatedSnrDb: 0,
      noiseLevel:     10,
      clarityScore:   0,
      qualityScore:   0,
      isValid:        false,
      issues:         ["Could not decode audio — file may be corrupted or unsupported."],
      suggestions:    ["Re-encode to WAV (44.1 kHz, 16-bit) and try again."],
    };
  }

  const durationSec = audioBuffer.duration;
  const sampleRate  = audioBuffer.sampleRate;
  const channels    = audioBuffer.numberOfChannels;
  const channelData = audioBuffer.getChannelData(0);

  // ── Duration checks ──────────────────────────────────────────────────────────
  if (durationSec < DATASET_CONSTRAINTS.MIN_DURATION_SEC) {
    issues.push(`Recording is too short (${durationSec.toFixed(1)}s — minimum ${DATASET_CONSTRAINTS.MIN_DURATION_SEC}s).`);
    suggestions.push("Record at least 5 seconds of clear speech per sample.");
  }
  if (durationSec > DATASET_CONSTRAINTS.MAX_DURATION_SEC) {
    issues.push(`Recording is too long (${durationSec.toFixed(0)}s — maximum ${DATASET_CONSTRAINTS.MAX_DURATION_SEC}s).`);
    suggestions.push("Split into shorter clips of 30–120 seconds for best results.");
  }

  // ── Sample rate check ────────────────────────────────────────────────────────
  if (sampleRate < 16000) {
    issues.push(`Low sample rate (${sampleRate} Hz — minimum 16 kHz recommended).`);
    suggestions.push("Record at 22.05 kHz or 44.1 kHz for better voice quality.");
  }

  // ── SNR analysis ─────────────────────────────────────────────────────────────
  const snrDb        = estimateSnr(channelData);
  const noiseLevel   = Math.max(0, Math.min(10, 10 - snrDb / 6));  // 0=quiet, 10=noisy
  const clarityScore = Math.max(0, Math.min(10, snrDb / 6));       // 0=bad, 10=excellent

  if (snrDb < 15) {
    issues.push("High background noise detected.");
    suggestions.push("Record in a quiet room and use a directional microphone.");
  } else if (snrDb < 25) {
    suggestions.push("Background noise is detectable. A quieter environment will improve quality.");
  }

  // ── Overall RMS — detect silence ─────────────────────────────────────────────
  const overallRms = computeRms(channelData);
  if (overallRms < 0.01) {
    issues.push("Recording appears to be nearly silent.");
    suggestions.push("Check your microphone levels before recording.");
  }

  // ── Quality score ─────────────────────────────────────────────────────────────
  let qualityScore = clarityScore;
  if (durationSec >= 30 && durationSec <= 120) qualityScore = Math.min(10, qualityScore + 1);
  if (sampleRate >= 44100)                       qualityScore = Math.min(10, qualityScore + 0.5);

  const isValid = issues.filter((i) => i.includes("short") || i.includes("corrupted") || i.includes("silent")).length === 0;

  return {
    durationSec,
    sampleRate,
    channels,
    estimatedSnrDb: Math.round(snrDb * 10) / 10,
    noiseLevel:     Math.round(noiseLevel * 10) / 10,
    clarityScore:   Math.round(clarityScore * 10) / 10,
    qualityScore:   Math.round(qualityScore * 10) / 10,
    isValid,
    issues,
    suggestions,
  };
}
