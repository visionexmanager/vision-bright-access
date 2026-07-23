/**
 * useVoiceCommands — generic voice-command listener for a fixed vocabulary,
 * built on the browser's SpeechRecognition API (feature-detected; exposes
 * `supported: false` and does nothing on browsers without it — a real
 * capability gate, not a stub). Mirrors the SpeechRecognition typing
 * pattern already established in src/components/AIChat.tsx (this browser
 * API isn't in every TS DOM lib version, so that file defines its own
 * minimal local types rather than assuming a global — same approach here).
 *
 * Scoped deliberately narrow: this hook only recognizes phrases handed to
 * it via `commands` (matched via substring on the lowercased transcript)
 * and calls the matching callback — it does not attempt open-ended
 * dictation or NLU.
 */

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionEventLike = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

interface UseVoiceCommandsOptions {
  /** Phrase (lowercase substring to match) → handler. */
  commands: Record<string, () => void>;
  lang?: string;
}

export function useVoiceCommands({ commands, lang }: UseVoiceCommandsOptions) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const shouldListenRef = useRef(false);
  const commandsRef = useRef(commands);
  commandsRef.current = commands;

  const [isListening, setIsListening] = useState(false);
  const [lastCommand, setLastCommand] = useState<string | null>(null);

  const supported = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const startRecognition = useCallback(() => {
    if (!supported) return;
    const speechWindow = window as SpeechWindow;
    const SpeechRecognitionCtor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = lang || "en-US";
    recognition.interimResults = false;
    recognition.continuous = true;

    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
      if (!transcript) return;
      setLastCommand(transcript);
      for (const [phrase, handler] of Object.entries(commandsRef.current)) {
        if (transcript.includes(phrase)) {
          handler();
          break;
        }
      }
    };
    recognition.onerror = () => {
      // 'no-speech'/'aborted' are routine pauses — just let onend's
      // restart-if-still-listening logic handle continuing.
    };
    recognition.onend = () => {
      if (shouldListenRef.current) recognition.start(); // browsers auto-stop continuous recognition after a silence timeout — restart transparently
      else setIsListening(false);
    };

    recognition.start();
    recognitionRef.current = recognition;
  }, [supported, lang]);

  const start = useCallback(() => {
    if (!supported || shouldListenRef.current) return;
    shouldListenRef.current = true;
    setIsListening(true);
    startRecognition();
  }, [supported, startRecognition]);

  const stop = useCallback(() => {
    shouldListenRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
  }, []);

  const toggle = useCallback(() => {
    if (isListening) stop();
    else start();
  }, [isListening, start, stop]);

  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      recognitionRef.current?.stop();
    };
  }, []);

  return { supported, isListening, lastCommand, toggle };
}
