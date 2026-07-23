/**
 * useLibrarianVoice — the AI Personal Librarian's voice assistant. Built
 * entirely on existing primitives, not new speech plumbing:
 *   - useVoiceCommands (continuous, fixed-vocabulary) for voice navigation
 *   - useReadAloud (Web Audio TTS, already wired to the user's voice/speed/
 *     pitch preferences) for voice reading of the daily motivational summary
 * "Voice search" and "voice notes"/"voice conversations" are served by the
 * existing VoiceSearchButton/useVoiceSearchDictation primitive directly at
 * their point of use (the AI Search page's input, the Librarian Chat's
 * input) rather than centralized here.
 */

import { useNavigate } from "react-router-dom";
import { useVoiceCommands } from "@/hooks/library/useVoiceCommands";
import { useReadAloud } from "@/hooks/library/useReadAloud";

export function useLibrarianVoice(motivationalSummary: string) {
  const navigate = useNavigate();
  const { play: playSummary, isPlaying } = useReadAloud(motivationalSummary || "");

  const { supported, isListening, lastCommand, toggle } = useVoiceCommands({
    commands: {
      "open chat": () => navigate("/library/librarian/chat"),
      "show recommendations": () => navigate("/library/librarian"),
      "show my profile": () => navigate("/library/librarian/profile"),
      "show goals": () => navigate("/library/librarian"),
      "show summaries": () => navigate("/library/librarian/summaries"),
      "show privacy": () => navigate("/library/librarian/privacy"),
      "read my summary": () => { if (motivationalSummary) void playSummary(); },
    },
  });

  return { supported, isListening, lastCommand, toggle, isPlayingSummary: isPlaying };
}
