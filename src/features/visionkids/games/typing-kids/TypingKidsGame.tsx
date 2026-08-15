import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { GameShell } from "@/features/visionkids/components/games/engine/GameShell";
import { useGameSession } from "@/features/visionkids/components/games/engine/useGameSession";
import { shuffle } from "@/features/visionkids/games/_shared/quizHelpers";
import type { Game } from "@/features/visionkids/types/games.types";

/**
 * Type the word you see. Difficulty climbs with the streak: single letters
 * first, then short words, then longer ones — a fixed word list would be
 * either too easy for the whole round or too hard from the first prompt.
 *
 * Matching is case-insensitive and ignores surrounding spaces, because the
 * skill being practised is finding the keys, not holding shift.
 */
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const SHORT_WORDS = ["cat", "dog", "sun", "hat", "run", "big", "red", "cup", "box", "pen"];
const LONG_WORDS = ["planet", "yellow", "friend", "school", "rocket", "garden", "orange", "window"];

const WIN_TARGET = 12;

function promptFor(streak: number): string {
  if (streak < 4) return shuffle(LETTERS)[0];
  if (streak < 8) return shuffle(SHORT_WORDS)[0];
  return shuffle(LONG_WORDS)[0];
}

export function TypingKidsGame({ game }: { game: Game }) {
  const { t } = useLanguage();
  const [target, setTarget] = useState(() => promptFor(0));
  const [typed, setTyped] = useState("");
  const [done, setDone] = useState(0);
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { state, start, pause, resume, addScore, loseLife, finish } = useGameSession({
    game,
    hasLives: true,
    startingLives: 3,
    hasTimer: true,
    timeLimitSeconds: 90,
  });

  useEffect(() => {
    if (state.status === "playing") inputRef.current?.focus();
  }, [state.status, target]);

  const handleStart = () => {
    setDone(0);
    setTyped("");
    setMessage("");
    setTarget(promptFor(0));
    start();
  };

  const submit = useCallback(() => {
    if (state.status !== "playing") return;
    const guess = typed.trim().toLowerCase();
    if (!guess) return;

    if (guess === target.toLowerCase()) {
      addScore(10 + target.length * 2);
      const total = done + 1;
      setDone(total);
      setTyped("");
      setMessage(t("kids.games.answerCorrect"));
      if (total >= WIN_TARGET) {
        finish({ won: true, isPerfectScore: state.lives === 3 });
        return;
      }
      setTarget(promptFor(total));
    } else {
      loseLife();
      setTyped("");
      setMessage(`${t("kids.games.answerWrong")} ${target}`);
    }
  }, [addScore, done, finish, loseLife, state.lives, state.status, t, target, typed]);

  return (
    <GameShell
      game={game}
      state={state}
      hasLives
      onStart={handleStart}
      onPause={pause}
      onResume={resume}
      onRestart={handleStart}
      resultSummary={<p className="text-sm text-muted-foreground">{t("kids.games.typedCount")}: {done}/{WIN_TARGET}</p>}
    >
      <div className="rounded-2xl border-2 border-border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">{t("kids.games.typingInstruction")}</p>

        <p className="mt-3 font-heading text-5xl font-extrabold tracking-wide text-kids-primary" aria-live="polite">
          {target}
        </p>

        <form
          className="mt-6 flex justify-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label htmlFor="typing-input" className="sr-only">{t("kids.games.typingInstruction")}</label>
          <input
            id="typing-input"
            ref={inputRef}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            className="w-48 rounded-xl border-2 border-border bg-card px-3 py-2 text-center text-xl font-bold"
          />
          <button
            type="submit"
            className="rounded-xl bg-kids-primary px-4 py-2 text-sm font-semibold text-white"
          >
            {t("kids.games.check")}
          </button>
        </form>

        <p className="mt-4 min-h-5 text-sm font-medium" role="status">{message}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("kids.games.typedCount")}: {done}/{WIN_TARGET}</p>
      </div>
    </GameShell>
  );
}

export default TypingKidsGame;
