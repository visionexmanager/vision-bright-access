import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Zap, Play, Pause, RotateCcw, Coffee, Settings2, Bell, BellOff } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

type Mode = "focus" | "shortBreak" | "longBreak";

const DEFAULT_DURATIONS: Record<Mode, number> = {
  focus: 25,
  shortBreak: 5,
  longBreak: 15,
};

const LABEL_KEYS: Record<Mode, string> = {
  focus: "pomodoro.focus",
  shortBreak: "pomodoro.shortBreak",
  longBreak: "pomodoro.longBreak",
};

const STORAGE_KEY = "pomodoro-custom-durations";

function loadCustomDurations(): Record<Mode, number> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        focus: parsed.focus ?? DEFAULT_DURATIONS.focus,
        shortBreak: parsed.shortBreak ?? DEFAULT_DURATIONS.shortBreak,
        longBreak: parsed.longBreak ?? DEFAULT_DURATIONS.longBreak,
      };
    }
  } catch { /* fallback */ }
  return { ...DEFAULT_DURATIONS };
}

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
  const [durations, setDurations] = useState<Record<Mode, number>>(loadCustomDurations);
  const [mode, setMode] = useState<Mode>("focus");
  const [timeLeft, setTimeLeft] = useState(durations.focus * 60);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [tempDurations, setTempDurations] = useState({ ...durations });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalSeconds = durations[mode] * 60;

  const reset = useCallback((newMode?: Mode) => {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    const m = newMode ?? mode;
    if (newMode) setMode(m);
    setTimeLeft(durations[m] * 60);
  }, [mode, durations]);

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
  const progress = ((totalSeconds - timeLeft) / totalSeconds) * 100;

  const isFocus = mode === "focus";

  const getButtonLabel = () => {
    if (running) return t("pomodoro.stop");
    if (timeLeft === 0 || timeLeft === totalSeconds) return t("pomodoro.start");
    return t("pomodoro.continue");
  };

  const applySettings = () => {
    setDurations({ ...tempDurations });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tempDurations));
    setTimeLeft(tempDurations[mode] * 60);
    setRunning(false);
    setShowSettings(false);
  };

  const resetDefaults = () => {
    setTempDurations({ ...DEFAULT_DURATIONS });
  };

  return (
    <div className="bg-card p-8 rounded-3xl shadow-lg border border-border flex flex-col items-center text-center">
      <div className="flex items-center justify-between w-full mb-4">
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
          {isFocus ? <Zap className="w-4 h-4 text-orange-500" /> : <Coffee className="w-4 h-4 text-emerald-500" />}
          {t(LABEL_KEYS[mode])}
        </h3>
        <button
          onClick={() => { setShowSettings(!showSettings); setTempDurations({ ...durations }); }}
          className={`p-1.5 rounded-lg transition-colors ${showSettings ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
          aria-label={t("pomodoro.settings")}
        >
          <Settings2 className="w-4 h-4" />
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="w-full mb-5 p-4 rounded-2xl bg-muted/40 border border-border space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <p className="text-xs font-bold text-foreground">{t("pomodoro.settings")}</p>

          {(["focus", "shortBreak", "longBreak"] as Mode[]).map((m) => (
            <div key={m} className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">{t(LABEL_KEYS[m])}</span>
                <span className="font-mono font-bold text-foreground">{tempDurations[m]} {t("pomodoro.min")}</span>
              </div>
              <Slider
                value={[tempDurations[m]]}
                onValueChange={([v]) => setTempDurations(prev => ({ ...prev, [m]: v }))}
                min={m === "focus" ? 5 : 1}
                max={m === "focus" ? 90 : 30}
                step={1}
                className="w-full"
              />
            </div>
          ))}

          <div className="flex gap-2 pt-1">
            <Button size="sm" className="flex-1 rounded-xl text-xs" onClick={applySettings}>
              {t("pomodoro.apply")}
            </Button>
            <Button size="sm" variant="outline" className="rounded-xl text-xs" onClick={resetDefaults}>
              {t("pomodoro.defaults")}
            </Button>
          </div>
        </div>
      )}

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
          {t("pomodoro.focusBtn")} {durations.focus !== DEFAULT_DURATIONS.focus ? `(${durations.focus})` : ""}
        </button>
        <button
          onClick={() => reset("shortBreak")}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${mode === "shortBreak" ? "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30" : "text-muted-foreground hover:bg-muted"}`}
        >
          {t("pomodoro.break5")} {durations.shortBreak !== DEFAULT_DURATIONS.shortBreak ? `(${durations.shortBreak})` : ""}
        </button>
        <button
          onClick={() => reset("longBreak")}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${mode === "longBreak" ? "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30" : "text-muted-foreground hover:bg-muted"}`}
        >
          {t("pomodoro.break15")} {durations.longBreak !== DEFAULT_DURATIONS.longBreak ? `(${durations.longBreak})` : ""}
        </button>
      </div>

      {sessions > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">{t("pomodoro.sessions").replace("{count}", String(sessions))}</p>
      )}
      <p className="mt-2 text-xs text-muted-foreground italic">{t("pomodoro.quote")}</p>
    </div>
  );
}
