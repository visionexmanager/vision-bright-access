import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { GameShell } from "@/features/visionkids/components/games/engine/GameShell";
import { useGameSession } from "@/features/visionkids/components/games/engine/useGameSession";
import { shuffle } from "@/features/visionkids/games/_shared/QuizGame";
import type { Game } from "@/features/visionkids/types/games.types";

/**
 * Sounds are synthesised with the Web Audio API rather than loaded as files:
 * no assets to ship, no network round-trip mid-round, and each one is
 * defined by parameters a child can actually tell apart (waveform, pitch,
 * and whether it rises, falls, or wobbles).
 *
 * This is the one game in the set that is audio-first, so it carries a
 * "play again" control and never auto-plays without the child asking — an
 * unexpected noise is worse than a missing one, especially for a screen
 * reader user who is already listening to speech.
 */
interface SoundDef {
  key: string;
  labelKey: string;
  wave: OscillatorType;
  startHz: number;
  endHz: number;
  seconds: number;
  wobbleHz?: number;
}

const SOUNDS: SoundDef[] = [
  { key: "drum", labelKey: "kids.games.soundDrum", wave: "sine", startHz: 160, endHz: 50, seconds: 0.45 },
  { key: "bell", labelKey: "kids.games.soundBell", wave: "sine", startHz: 880, endHz: 860, seconds: 1.1 },
  { key: "bird", labelKey: "kids.games.soundBird", wave: "sine", startHz: 1400, endHz: 2100, seconds: 0.5, wobbleHz: 14 },
  { key: "siren", labelKey: "kids.games.soundSiren", wave: "sawtooth", startHz: 500, endHz: 900, seconds: 1.0, wobbleHz: 2 },
  { key: "robot", labelKey: "kids.games.soundRobot", wave: "square", startHz: 220, endHz: 180, seconds: 0.7, wobbleHz: 20 },
  { key: "whistle", labelKey: "kids.games.soundWhistle", wave: "triangle", startHz: 1800, endHz: 2600, seconds: 0.6 },
  { key: "engine", labelKey: "kids.games.soundEngine", wave: "sawtooth", startHz: 90, endHz: 130, seconds: 0.9, wobbleHz: 8 },
  { key: "boing", labelKey: "kids.games.soundBoing", wave: "triangle", startHz: 700, endHz: 180, seconds: 0.5, wobbleHz: 6 },
];

const WIN_TARGET = 8;

export function GuessSoundGame({ game }: { game: Game }) {
  const { t } = useLanguage();
  const audioRef = useRef<AudioContext | null>(null);
  const [target, setTarget] = useState<SoundDef>(() => shuffle(SOUNDS)[0]);
  const [options, setOptions] = useState<SoundDef[]>(() => shuffle(SOUNDS).slice(0, 4));
  const [correct, setCorrect] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");

  const { state, start, pause, resume, addScore, loseLife, finish } = useGameSession({
    game,
    hasLives: true,
    startingLives: 3,
  });

  useEffect(() => () => { void audioRef.current?.close(); }, []);

  const play = useCallback((sound: SoundDef) => {
    // Created on the first play, never before: browsers require a user
    // gesture, and constructing it earlier leaves a suspended context around.
    audioRef.current ??= new AudioContext();
    const ctx = audioRef.current;
    void ctx.resume();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = sound.wave;
    osc.frequency.setValueAtTime(sound.startHz, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, sound.endHz), now + sound.seconds);

    if (sound.wobbleHz) {
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.setValueAtTime(sound.wobbleHz, now);
      lfoGain.gain.setValueAtTime(sound.startHz * 0.12, now);
      lfo.connect(lfoGain).connect(osc.frequency);
      lfo.start(now);
      lfo.stop(now + sound.seconds);
    }

    // Short fade in and out so the note never clicks.
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.25, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + sound.seconds);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + sound.seconds + 0.05);
  }, []);

  const nextRound = useCallback(() => {
    const pool = shuffle(SOUNDS);
    const picks = pool.slice(0, 4);
    const answer = picks[Math.floor(Math.random() * picks.length)];
    setOptions(shuffle(picks));
    setTarget(answer);
    setPicked(null);
    play(answer);
  }, [play]);

  const handleStart = () => {
    setCorrect(0);
    setFeedback("");
    start();
    nextRound();
  };

  const pick = (sound: SoundDef) => {
    if (picked) return;
    setPicked(sound.key);

    if (sound.key === target.key) {
      addScore(10);
      const total = correct + 1;
      setCorrect(total);
      setFeedback(t("kids.games.answerCorrect"));
      window.setTimeout(() => {
        if (total >= WIN_TARGET) finish({ won: true, isPerfectScore: state.lives === 3 });
        else nextRound();
      }, 700);
    } else {
      loseLife();
      setFeedback(`${t("kids.games.answerWrong")} ${t(target.labelKey)}`);
      window.setTimeout(nextRound, 1000);
    }
  };

  return (
    <GameShell
      game={game}
      state={state}
      hasLives
      onStart={handleStart}
      onPause={pause}
      onResume={resume}
      onRestart={handleStart}
      resultSummary={<p className="text-sm text-muted-foreground">{t("kids.games.correctAnswers")}: {correct}/{WIN_TARGET}</p>}
    >
      <div className="rounded-2xl border-2 border-border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">{t("kids.games.whichSound")}</p>

        <button
          type="button"
          onClick={() => play(target)}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-kids-primary px-5 py-3 text-base font-semibold text-white"
        >
          <Volume2 className="h-5 w-5" aria-hidden="true" />
          {t("kids.games.playSoundAgain")}
        </button>

        <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {options.map((sound) => {
            const isAnswer = sound.key === target.key;
            const isPicked = sound.key === picked;
            const tone = !picked
              ? "border-border hover:border-kids-primary/60"
              : isAnswer
                ? "border-kids-green bg-kids-green/10"
                : isPicked
                  ? "border-destructive bg-destructive/10"
                  : "border-border opacity-60";
            return (
              <li key={sound.key}>
                <button
                  type="button"
                  onClick={() => pick(sound)}
                  disabled={!!picked}
                  className={`w-full rounded-2xl border-2 px-4 py-3 text-base font-semibold transition-colors ${tone}`}
                >
                  {t(sound.labelKey)}
                </button>
              </li>
            );
          })}
        </ul>

        <p className="mt-4 min-h-5 text-sm font-medium" role="status">{feedback}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("kids.games.correctAnswers")}: {correct}/{WIN_TARGET}</p>
      </div>
    </GameShell>
  );
}

export default GuessSoundGame;
