import { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { fadeIn } from "@/features/visionkids/utils/animations";
import { GameShell } from "@/features/visionkids/components/games/engine/GameShell";
import { useGameSession } from "@/features/visionkids/components/games/engine/useGameSession";
import type { Game } from "@/features/visionkids/types/games.types";

const WIN_TARGET = 10;

const COLORS = [
  { key: "red", labelKey: "kids.games.colorRed", hex: "#ef4444" },
  { key: "blue", labelKey: "kids.games.colorBlue", hex: "#3b82f6" },
  { key: "green", labelKey: "kids.games.colorGreen", hex: "#22c55e" },
  { key: "yellow", labelKey: "kids.games.colorYellow", hex: "#eab308" },
  { key: "purple", labelKey: "kids.games.colorPurple", hex: "#a855f7" },
  { key: "orange", labelKey: "kids.games.colorOrange", hex: "#f97316" },
];

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildRound() {
  const options = shuffle(COLORS).slice(0, 4);
  const target = options[Math.floor(Math.random() * options.length)];
  return { target, options: shuffle(options) };
}

export function ColorMatchGame({ game }: { game: Game }) {
  const { t } = useLanguage();
  const reduced = useKidsReducedMotion();
  const [round, setRound] = useState(() => buildRound());
  const [matches, setMatches] = useState(0);
  const [flash, setFlash] = useState<"correct" | "wrong" | null>(null);

  const { state, start, pause, resume, restart, addScore, loseLife, finish } = useGameSession({
    game,
    hasLives: true,
    startingLives: 3,
    hasTimer: true,
    timeLimitSeconds: 45,
  });

  const nextRound = useCallback(() => setRound(buildRound()), []);

  const handleStart = () => { setMatches(0); nextRound(); start(); };

  const tap = (key: string) => {
    if (flash) return;
    const correct = key === round.target.key;
    setFlash(correct ? "correct" : "wrong");
    if (correct) {
      addScore(10);
      const total = matches + 1;
      setMatches(total);
      window.setTimeout(() => {
        setFlash(null);
        if (total >= WIN_TARGET) finish({ won: true, isPerfectScore: state.lives === 3 });
        else nextRound();
      }, 250);
    } else {
      loseLife();
      window.setTimeout(() => setFlash(null), 400);
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
      resultSummary={<p className="text-sm text-muted-foreground">{t("kids.games.matches")}: {matches}/{WIN_TARGET}</p>}
    >
      <div className="rounded-2xl border-2 border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">{t("kids.games.tapTheColor")}</p>
        <AnimatePresence mode="wait">
          <motion.p key={round.target.key + matches} initial="hidden" animate="visible" exit="hidden" variants={fadeIn(reduced)} className="mt-1 font-heading text-3xl font-extrabold" style={{ color: round.target.hex }}>
            {t(round.target.labelKey)}
          </motion.p>
        </AnimatePresence>

        <div className="mt-6 grid grid-cols-2 gap-3">
          {round.options.map((color) => (
            <button
              key={color.key}
              type="button"
              onClick={() => tap(color.key)}
              aria-label={t(color.labelKey)}
              className={`aspect-square rounded-2xl border-4 transition-transform ${
                flash === "correct" && color.key === round.target.key ? "scale-95 border-kids-green" : flash === "wrong" && color.key !== round.target.key ? "border-border" : "border-transparent hover:scale-105"
              }`}
              style={{ backgroundColor: color.hex }}
            />
          ))}
        </div>
      </div>
    </GameShell>
  );
}

export default ColorMatchGame;
