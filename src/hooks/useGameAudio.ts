import { useCallback, useRef, useEffect } from "react";

// Web Audio API sound effect generator - no external dependencies
const audioCtxRef = { current: null as AudioContext | null };

function getAudioContext(): AudioContext {
  if (!audioCtxRef.current) {
    audioCtxRef.current = new AudioContext();
  }
  if (audioCtxRef.current.state === "suspended") {
    audioCtxRef.current.resume();
  }
  return audioCtxRef.current;
}

type SoundType =
  | "flip"
  | "match"
  | "noMatch"
  | "complete"
  | "correct"
  | "wrong"
  | "select"
  | "place"
  | "hint"
  | "tick"
  | "cooking"
  | "sizzle"
  | "unlock"
  | "levelUp"
  | "scan"
  | "heal"
  | "snip"
  | "spray"
  | "pour"
  | "bubble"
  | "ding"
  | "whoosh";

function playTone(frequency: number, duration: number, type: OscillatorType = "sine", gain = 0.15) {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Audio not supported
  }
}

function playChord(frequencies: number[], duration: number, type: OscillatorType = "sine", gain = 0.1) {
  frequencies.forEach((f, i) => {
    setTimeout(() => playTone(f, duration, type, gain), i * 60);
  });
}

function playNoise(duration: number, gain = 0.05) {
  try {
    const ctx = getAudioContext();
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const g = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 3000;
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    source.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    source.start();
  } catch {
    // Audio not supported
  }
}

const SOUNDS: Record<SoundType, () => void> = {
  flip: () => playTone(600, 0.12, "sine", 0.12),
  match: () => playChord([523, 659, 784], 0.4, "sine", 0.12),
  noMatch: () => {
    playTone(300, 0.15, "square", 0.08);
    setTimeout(() => playTone(250, 0.2, "square", 0.08), 150);
  },
  complete: () => playChord([523, 659, 784, 1047], 0.6, "sine", 0.1),
  correct: () => playChord([440, 554, 659], 0.35, "sine", 0.12),
  wrong: () => {
    playTone(200, 0.2, "sawtooth", 0.06);
    setTimeout(() => playTone(160, 0.3, "sawtooth", 0.06), 200);
  },
  select: () => playTone(500, 0.08, "sine", 0.1),
  place: () => playTone(700, 0.1, "sine", 0.1),
  hint: () => playChord([392, 494], 0.3, "triangle", 0.1),
  tick: () => playTone(800, 0.05, "sine", 0.08),
  // Simulation-specific sounds
  cooking: () => {
    playNoise(0.3, 0.04);
    playTone(220, 0.2, "sawtooth", 0.04);
  },
  sizzle: () => playNoise(0.5, 0.06),
  unlock: () => {
    playChord([392, 494, 587, 784], 0.5, "sine", 0.12);
  },
  levelUp: () => {
    playTone(523, 0.15, "sine", 0.1);
    setTimeout(() => playTone(659, 0.15, "sine", 0.1), 120);
    setTimeout(() => playTone(784, 0.15, "sine", 0.1), 240);
    setTimeout(() => playTone(1047, 0.3, "sine", 0.12), 360);
  },
  scan: () => {
    playTone(1200, 0.4, "sine", 0.06);
    setTimeout(() => playTone(1400, 0.3, "sine", 0.06), 200);
  },
  heal: () => playChord([440, 554, 659], 0.4, "triangle", 0.1),
  snip: () => {
    playTone(1800, 0.05, "square", 0.06);
    setTimeout(() => playTone(2200, 0.04, "square", 0.06), 60);
  },
  spray: () => playNoise(0.25, 0.05),
  pour: () => {
    playTone(180, 0.4, "sine", 0.06);
    playNoise(0.3, 0.03);
  },
  bubble: () => {
    [600, 700, 650, 750, 680].forEach((f, i) => {
      setTimeout(() => playTone(f, 0.08, "sine", 0.06), i * 80);
    });
  },
  ding: () => playTone(1200, 0.3, "sine", 0.12),
  whoosh: () => {
    const ctx = getAudioContext();
    try {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.15);
      osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.3);
      g.gain.setValueAtTime(0.08, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {}
  },
};

export function useGameAudio() {
  const enabledRef = useRef(true);

  const playSound = useCallback((sound: SoundType) => {
    if (enabledRef.current) {
      SOUNDS[sound]();
    }
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    enabledRef.current = enabled;
  }, []);

  return { playSound, setEnabled, enabledRef };
}

// Text-to-Speech helper
export function useGameTTS() {
  const enabledRef = useRef(true);

  const speak = useCallback((text: string, lang = "en") => {
    if (!enabledRef.current || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const langMap: Record<string, string> = {
      ar: "ar-SA", es: "es-ES", de: "de-DE", fr: "fr-FR",
      pt: "pt-BR", tr: "tr-TR", ru: "ru-RU", zh: "zh-CN", en: "en-US",
    };
    utterance.lang = langMap[lang] || "en-US";
    utterance.rate = 0.9;
    utterance.volume = 0.8;
    window.speechSynthesis.speak(utterance);
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    enabledRef.current = enabled;
  }, []);

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
  }, []);

  return { speak, setEnabled, stop, enabledRef };
}
