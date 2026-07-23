/**
 * useReadAloud — AI text-to-speech read-aloud for books with no audiobook
 * edition, built on the Web Audio API rather than a plain <audio> element.
 * That's a deliberate engine choice, not incidental: OpenAI's speech
 * endpoint (via the shared text-to-speech function, textToSpeech.ts) has no
 * pitch parameter, and a plain <audio> element's playbackRate changes both
 * tempo AND pitch together. AudioBufferSourceNode exposes tempo
 * (.playbackRate) and pitch (.detune, in cents) as two independent
 * AudioParams — the standard way to get real pitch control without an
 * external DSP library.
 *
 * Splits the given text into sentences (unchanged from the original
 * design — the edge function has no word/sentence-timestamp output, so
 * this is the only way to keep highlighting synced to what's actually
 * playing) and decodes/plays one sentence-buffer at a time, prefetching
 * sentence N+1's audio while N plays. Voice/speed/pitch are read from
 * useAiReadingPreferences (not local state) so changes persist across
 * sessions/devices for free — this hook just applies them to the audio
 * graph.
 *
 * AudioBufferSourceNode has no native pause/resume (Web Audio API
 * limitation) — pause() records how far into the current sentence's buffer
 * playback had reached and tears the node down; resume()/play() create a
 * fresh node starting from that recorded offset. stop() is distinct from
 * pause(): it discards the recorded position entirely, back to the start.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchSpeechArrayBuffer } from "@/lib/library/textToSpeech";
import { useAiReadingPreferences } from "@/hooks/library/useAiReadingPreferences";

function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?؟۔])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function bufferCacheKey(index: number, voice: string): string {
  return `${index}:${voice}`;
}

export function useReadAloud(text: string) {
  const { voice, speed, pitch, setVoice, setSpeed, setPitch } = useAiReadingPreferences();

  const sentencesRef = useRef<string[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const bufferCacheRef = useRef<Map<string, AudioBuffer>>(new Map());
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  /** ctx.currentTime when the current source node's start() was called. */
  const startedAtCtxTimeRef = useRef(0);
  /** Buffer-seconds into the current sentence to resume from next. */
  const offsetRef = useRef(0);
  const prevVoiceRef = useRef(voice);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(-1);

  const getAudioContext = useCallback((): AudioContext => {
    if (!audioContextRef.current) audioContextRef.current = new AudioContext();
    return audioContextRef.current;
  }, []);

  const teardownSource = useCallback(() => {
    const node = sourceNodeRef.current;
    if (!node) return;
    node.onended = null; // prevents the natural-end auto-advance handler from firing on a manual stop/pause/replay
    try {
      node.stop();
    } catch {
      // Already stopped — fine to ignore.
    }
    node.disconnect();
    sourceNodeRef.current = null;
  }, []);

  const getAudioBuffer = useCallback(
    async (index: number, voiceForFetch: string): Promise<AudioBuffer> => {
      const sentences = sentencesRef.current;
      if (index < 0 || index >= sentences.length) throw new Error("Sentence index out of range");
      const key = bufferCacheKey(index, voiceForFetch);
      const cached = bufferCacheRef.current.get(key);
      if (cached) return cached;
      const arrayBuffer = await fetchSpeechArrayBuffer(sentences[index], { voice: voiceForFetch });
      const audioBuffer = await getAudioContext().decodeAudioData(arrayBuffer);
      bufferCacheRef.current.set(key, audioBuffer);
      return audioBuffer;
    },
    [getAudioContext]
  );

  const playFromOffset = useCallback(
    async (index: number, offsetSeconds: number) => {
      const sentences = sentencesRef.current;
      if (index < 0 || index >= sentences.length) {
        teardownSource();
        setIsPlaying(false);
        setCurrentSentenceIndex(-1);
        offsetRef.current = 0;
        return;
      }

      setIsLoading(true);
      let buffer: AudioBuffer;
      try {
        buffer = await getAudioBuffer(index, voice);
      } catch {
        setIsLoading(false);
        setIsPlaying(false);
        return;
      }
      setIsLoading(false);

      teardownSource();

      const ctx = getAudioContext();
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = speed;
      source.detune.value = pitch;
      source.connect(ctx.destination);
      source.onended = () => {
        void playFromOffset(index + 1, 0);
      };

      sourceNodeRef.current = source;
      startedAtCtxTimeRef.current = ctx.currentTime;
      offsetRef.current = offsetSeconds;
      source.start(0, offsetSeconds);

      setCurrentSentenceIndex(index);
      setIsPlaying(true);

      void getAudioBuffer(index + 1, voice).catch(() => {}); // prefetch next sentence while this one plays
    },
    [getAudioBuffer, getAudioContext, teardownSource, voice, speed, pitch]
  );

  const stop = useCallback(() => {
    teardownSource();
    offsetRef.current = 0;
    setIsPlaying(false);
    setCurrentSentenceIndex(-1);
  }, [teardownSource]);

  useEffect(() => {
    sentencesRef.current = splitIntoSentences(text);
    bufferCacheRef.current.clear();
    stop();
  }, [text, stop]);

  const play = useCallback(() => {
    if (isPlaying) return;
    void playFromOffset(currentSentenceIndex < 0 ? 0 : currentSentenceIndex, currentSentenceIndex < 0 ? 0 : offsetRef.current);
  }, [isPlaying, currentSentenceIndex, playFromOffset]);

  const pause = useCallback(() => {
    if (!sourceNodeRef.current) return;
    const ctx = getAudioContext();
    const elapsedBufferSeconds = (ctx.currentTime - startedAtCtxTimeRef.current) * speed;
    offsetRef.current += elapsedBufferSeconds;
    teardownSource();
    setIsPlaying(false);
  }, [getAudioContext, teardownSource, speed]);

  const resume = useCallback(() => {
    if (currentSentenceIndex < 0) {
      void playFromOffset(0, 0);
    } else {
      void playFromOffset(currentSentenceIndex, offsetRef.current);
    }
  }, [currentSentenceIndex, playFromOffset]);

  // Live speed/pitch updates apply to whatever's currently playing —
  // AudioParams take effect immediately, no restart needed.
  useEffect(() => {
    if (sourceNodeRef.current) sourceNodeRef.current.playbackRate.value = speed;
  }, [speed]);
  useEffect(() => {
    if (sourceNodeRef.current) sourceNodeRef.current.detune.value = pitch;
  }, [pitch]);

  // Voice changes require a different audio file entirely — restart the
  // current sentence from its beginning with the new voice if playback is
  // active; otherwise the new voice just applies to the next play().
  useEffect(() => {
    if (prevVoiceRef.current === voice) return;
    prevVoiceRef.current = voice;
    if (isPlaying && currentSentenceIndex >= 0) void playFromOffset(currentSentenceIndex, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally reacts to `voice` only, not isPlaying/currentSentenceIndex/playFromOffset
  }, [voice]);

  useEffect(() => {
    return () => {
      teardownSource();
      void audioContextRef.current?.close().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount-only cleanup
  }, []);

  return {
    isPlaying,
    isLoading,
    currentSentenceIndex,
    sentenceCount: sentencesRef.current.length,
    speed,
    pitch,
    voice,
    play,
    pause,
    resume,
    stop,
    setSpeed,
    setPitch,
    setVoice,
  };
}
