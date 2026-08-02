export type LegacyAudioFinding = {
  implementation: string;
  scope: string;
  finding: string;
  disposition: "keep-temporarily" | "improve" | "replace";
};

/** Inventory only. Legacy playback remains untouched until mastered replacements are approved. */
export const LEGACY_AUDIO_AUDIT: readonly LegacyAudioFinding[] = [
  {
    implementation: "src/hooks/useGameSounds.ts",
    scope: "Shared game feedback",
    finding: "Oscillator-generated cues are functional and lightweight, but not realistic production effects.",
    disposition: "replace",
  },
  {
    implementation: "src/hooks/useGameAudio.ts",
    scope: "Shared success, failure, click, and sequence cues",
    finding: "Synthesized tones are accessible as temporary signals but lack recorded material and mastering.",
    disposition: "replace",
  },
  {
    implementation: "src/pages/QuizChallenge.tsx",
    scope: "Quiz answer and completion feedback",
    finding: "Remote preview MP3 URLs were removed in Phase 13. Feedback remains silent until a licensed mastered replacement is approved.",
    disposition: "replace",
  },
];
