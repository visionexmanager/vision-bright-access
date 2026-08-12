import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useGameEconomy } from "@/components/game/GameEconomyGate";
import { gameManager } from "@/features/arcade/core/gameManager";
import { playProductionSound } from "@/features/arcade/audio/playProductionSound";
import { SportsActionMotion, type ArenaSportKind } from "@/features/arcade/motion/SportsActionMotion";
import { airHockeyShot, basketballShot, penaltyShot, tableTennisReturn, type ShotResult } from "@/lib/games/arcadeArenaSportsEngine";

type GameConfig = {
  title: string;
  instructions: string;
  primaryLabel: string;
  secondaryLabel: string;
  action: string;
  opponentLabel: string;
  displayOpponent?: (opponent: number, round: number) => number;
  evaluate: (primary: number, secondary: number, opponent: number, round: number) => ShotResult;
  sport?: ArenaSportKind;
};

const panel = "mx-auto max-w-3xl space-y-6 p-4 sm:p-8";
const opponents = [35, 68, 22, 76, 48, 84, 31, 62];

function ArenaSport({ config }: { config: GameConfig }) {
  const [primary, setPrimary] = useState(50);
  const [secondary, setSecondary] = useState(65);
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState(config.instructions);
  const [lastResult, setLastResult] = useState<boolean | null>(null);
  const [attempt, setAttempt] = useState(0);
  const { settleGameResult } = useGameEconomy();
  const opponent = opponents[round - 1];
  const displayedOpponent = config.displayOpponent?.(opponent, round) ?? opponent;

  const play = () => {
    const result = config.evaluate(primary, secondary, opponent, round);
    const nextScore = score + (result.scored ? 1 : 0);
    setScore(nextScore);
    setLastResult(result.scored);
    setAttempt((current) => current + 1);
    setMessage(`${result.scored ? "Point scored" : "Attempt stopped"}. Shot quality ${result.quality}%.`);
    if (round === opponents.length) {
      gameManager.recordScore(nextScore * 125 + result.quality);
      const won = nextScore >= 5;
      void playProductionSound(won ? "natural-victory" : "natural-failure", { volume:0.55 });
      void settleGameResult(won ? "win" : "loss", config.title);
    } else {
      setRound(round + 1);
    }
  };

  return <main className={panel}>
    <header className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-black">{config.title}</h1><strong>Round {round} / {opponents.length} · Score {score}</strong></div>
      <p>{config.instructions}</p>
    </header>
    <div className="rounded-3xl border bg-gradient-to-br from-emerald-950 via-slate-900 to-blue-950 p-8 text-white shadow-xl">
      <p className="text-center text-lg font-bold">{config.opponentLabel}: {displayedOpponent}</p>
      {config.sport && <SportsActionMotion sport={config.sport} attempt={attempt} scored={lastResult} />}
      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <Control label={config.primaryLabel} value={primary} onChange={setPrimary} />
        <Control label={config.secondaryLabel} value={secondary} onChange={setSecondary} />
      </div>
    </div>
    <Button className="w-full" size="lg" onClick={play}>{config.action}</Button>
    <p role="status" aria-live="polite" className="font-bold">{message}</p>
  </main>;
}

function Control({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="space-y-3"><span className="flex justify-between font-bold">{label}<output>{value}</output></span><Slider aria-label={label} value={[value]} onValueChange={(next) => onChange(next[0])} min={1} max={100} /></label>;
}

export function PenaltyShootout() { return <ArenaSport config={{ title:"Penalty Shootout", instructions:"Place eight controlled shots away from the announced keeper position. Score five goals to win.", primaryLabel:"Aim lane", secondaryLabel:"Power", action:"Take penalty", opponentLabel:"Keeper position", sport:"penalty", evaluate:(aim,power,keeper)=>penaltyShot(aim,power,keeper) }} />; }
export function BasketballChallenge() { return <ArenaSport config={{ title:"Basketball Challenge", instructions:"Match shot power to distance and keep aim near the center. Make five baskets to win.", primaryLabel:"Power", secondaryLabel:"Aim", action:"Shoot basket", opponentLabel:"Distance", sport:"basketball", displayOpponent:(_opponent,round)=>3+round, evaluate:(power,aim,_opponent,round)=>basketballShot(power,aim,3+round) }} />; }
export function TableTennis() { return <ArenaSport config={{ title:"Table Tennis", instructions:"Place each return away from your opponent while keeping spin under control. Win five rallies.", primaryLabel:"Placement", secondaryLabel:"Spin", action:"Return ball", opponentLabel:"Opponent position", sport:"table-tennis", evaluate:(placement,spin,opponent)=>tableTennisReturn(placement,spin,opponent) }} />; }
export function AirHockey() { return <ArenaSport config={{ title:"Air Hockey", instructions:"Choose a shooting lane away from the defender and apply controlled power. Score five goals.", primaryLabel:"Direction", secondaryLabel:"Power", action:"Strike puck", opponentLabel:"Defense position", sport:"air-hockey", evaluate:(direction,power,defense)=>airHockeyShot(direction,power,defense) }} />; }
