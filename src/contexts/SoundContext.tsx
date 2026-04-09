import { createContext, useContext, useCallback, useRef, useEffect, ReactNode, useState } from "react";

// ─── Web Audio tone helpers ───────────────────────────────────────────
let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.12) {
  try {
    const ctx = getCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur);
  } catch {}
}

function chord(freqs: number[], dur: number, type: OscillatorType = "sine", vol = 0.08) {
  freqs.forEach((f, i) => setTimeout(() => tone(f, dur, type, vol), i * 50));
}

// ─── Sound catalogue ──────────────────────────────────────────────────
export type UISoundType =
  | "navigate"
  | "click"
  | "success"
  | "error"
  | "hover"
  | "open"
  | "close"
  | "points"
  | "levelUp"
  | "achievement"
  | "send"
  | "receive"
  | "toggle"
  | "delete"
  | "refresh"
  | "tab"
  | "notification"
  | "complete"
  | "start";

const UI_SOUNDS: Record<UISoundType, () => void> = {
  navigate: () => tone(500, 0.08, "sine", 0.08),
  click: () => tone(600, 0.06, "sine", 0.06),
  success: () => chord([523, 659, 784], 0.35, "sine", 0.1),
  error: () => {
    tone(300, 0.12, "square", 0.06);
    setTimeout(() => tone(250, 0.15, "square", 0.06), 120);
  },
  hover: () => tone(800, 0.03, "sine", 0.03),
  open: () => {
    tone(400, 0.1, "sine", 0.06);
    setTimeout(() => tone(600, 0.1, "sine", 0.06), 80);
  },
  close: () => {
    tone(600, 0.08, "sine", 0.05);
    setTimeout(() => tone(400, 0.1, "sine", 0.05), 60);
  },
  points: () => chord([523, 659], 0.25, "sine", 0.1),
  levelUp: () => {
    tone(523, 0.12, "sine", 0.1);
    setTimeout(() => tone(659, 0.12, "sine", 0.1), 100);
    setTimeout(() => tone(784, 0.12, "sine", 0.1), 200);
    setTimeout(() => tone(1047, 0.25, "sine", 0.12), 300);
  },
  achievement: () => chord([392, 494, 587, 784], 0.5, "sine", 0.1),
  send: () => {
    tone(400, 0.08, "sine", 0.06);
    setTimeout(() => tone(700, 0.1, "sine", 0.06), 60);
  },
  receive: () => tone(800, 0.12, "triangle", 0.08),
  toggle: () => tone(700, 0.05, "sine", 0.06),
  delete: () => tone(250, 0.2, "sawtooth", 0.05),
  refresh: () => {
    const ctx = getCtx();
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(400, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.15);
      o.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.3);
      g.gain.setValueAtTime(0.06, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.3);
    } catch {}
  },
  tab: () => tone(550, 0.05, "sine", 0.05),
  notification: () => {
    tone(880, 0.1, "sine", 0.08);
    setTimeout(() => tone(1100, 0.12, "sine", 0.08), 100);
  },
  complete: () => chord([523, 659, 784, 1047], 0.5, "sine", 0.1),
  start: () => chord([440, 554], 0.2, "sine", 0.08),
};

// ─── Context ──────────────────────────────────────────────────────────
type SoundContextType = {
  playSound: (sound: UISoundType) => void;
  enabled: boolean;
  setEnabled: (v: boolean) => void;
};

const SoundContext = createContext<SoundContextType>({
  playSound: () => {},
  enabled: true,
  setEnabled: () => {},
});

export function SoundProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(() => {
    return localStorage.getItem("visionex-sound") !== "false";
  });
  const enabledRef = useRef(enabled);

  useEffect(() => {
    enabledRef.current = enabled;
    localStorage.setItem("visionex-sound", String(enabled));
  }, [enabled]);

  // Listen for storage changes from Settings page
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "visionex-sound") {
        const v = e.newValue !== "false";
        setEnabledState(v);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const playSound = useCallback((sound: UISoundType) => {
    if (enabledRef.current) UI_SOUNDS[sound]();
  }, []);

  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v);
  }, []);

  return (
    <SoundContext.Provider value={{ playSound, enabled, setEnabled }}>
      {children}
    </SoundContext.Provider>
  );
}

export function useSound() {
  return useContext(SoundContext);
}
