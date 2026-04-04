import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Zap, Play, Pause, RotateCcw, Coffee } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

type Mode = "focus" | "shortBreak" | "longBreak";

const DURATIONS: Record<Mode, number> = {
  focus: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
};

const LABEL_KEYS: Record<Mode, string> = {
  focus: "pomodoro.focus",
  shortBreak: "pomodoro.shortBreak",
  longBreak: "pomodoro.longBreak",
};

function playAlarm() {
  try {
    const ctx = new AudioContext();
    const playBeep = (time: number, freq: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.3, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.4);
      osc.start(time);
      osc.stop(time + 0.4);
    };
    playBeep(ctx.currentTime, 880);
    playBeep(ctx.currentTime + 0.5, 880);
    playBeep(ctx.currentTime + 1.0, 1100);
  } catch { /* silent fallback */ }
}

export default function PomodoroTimer() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<Mode>("focus");
  const [timeLeft, setTimeLeft] = useState(DURATIONS.focus);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const reset = useCallback((newMode?: Mode) => {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    const m = newMode ?? mode;
    if (newMode) setMode(m);
    setTimeLeft(DURATIONS[m]);
  }, [mode]);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          setRunning(false);
          playAlarm();
          if (mode === "focus") {
            setSessions(s => s + 1);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, mode]);

  const mins = Math.floor(timeLeft / 60).toString().padStart(2, "0");
  const secs = (timeLeft % 60).toString().padStart(2, "0");
  const progress = ((DURATIONS[mode] - timeLeft) / DURATIONS[mode]) * 100;

  const isFocus = mode === "focus";

  const getButtonLabel = () => {
    if (running) return t("pomodoro.stop");
    if (timeLeft === 0 || timeLeft === DURATIONS[mode]) return t("pomodoro.start");
    return t("pomodoro.continue");
  };

  return (
    <div className="bg-card p-8 rounded-3xl shadow-lg border border-border flex flex-col items-center text-center">
      <h3 className="text-sm font-bold text-muted-foreground mb-4 uppercase tracking-widest flex items-center gap-2">
        {isFocus ? <Zap className="w-4 h-4 text-orange-500" /> : <Coffee className="w-4 h-4 text-emerald-500" />}
        {t(LABEL_KEYS[mode])}
      </h3>

      {/* Circular progress */}
      <div className="relative w-44 h-44 mb-4">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" strokeWidth="6" className="stroke-muted/30" />
          <circle
            cx="50" cy="50" r="45" fill="none" strokeWidth="6"
            className={isFocus ? "stroke-orange-500" : "stroke-emerald-500"}
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 45}`}
            strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
            style={{ transition: "stroke-dashoffset 0.5s" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-4xl font-black text-foreground tracking-tighter font-mono">{mins}:{secs}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-3 mb-4 w-full">
        <Button
          onClick={() => setRunning(!running)}
          className={`flex-1 py-5 h-auto rounded-2xl font-bold text-base gap-2 ${
            isFocus
              ? "bg-orange-500 hover:bg-orange-600 text-white"
              : "bg-emerald-500 hover:bg-emerald-600 text-white"
          }`}
        >
          {running ? <><Pause className="w-5 h-5" /> {t("pomodoro.stop")}</> : <><Play className="w-5 h-5" /> {getButtonLabel()}</>}
        </Button>
        <Button variant="outline" size="icon" className="h-auto w-14 rounded-2xl" onClick={() => reset()}>
          <RotateCcw className="w-5 h-5" />
        </Button>
      </div>

      {/* Mode switcher */}
      <div className="flex gap-2 w-full">
        <button
          onClick={() => reset("focus")}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${mode === "focus" ? "bg-orange-500/15 text-orange-600 border border-orange-500/30" : "text-muted-foreground hover:bg-muted"}`}
        >
          {t("pomodoro.focusBtn")}
        </button>
        <button
          onClick={() => reset("shortBreak")}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${mode === "shortBreak" ? "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30" : "text-muted-foreground hover:bg-muted"}`}
        >
          {t("pomodoro.break5")}
        </button>
        <button
          onClick={() => reset("longBreak")}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${mode === "longBreak" ? "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30" : "text-muted-foreground hover:bg-muted"}`}
        >
          {t("pomodoro.break15")}
        </button>
      </div>

      {sessions > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">{t("pomodoro.sessions").replace("{count}", String(sessions))}</p>
      )}
      <p className="mt-2 text-xs text-muted-foreground italic">{t("pomodoro.quote")}</p>
    </div>
  );
}
