import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useGameSounds } from "@/hooks/useGameSounds";
import { useHighScore } from "@/hooks/useHighScore";
import { GameHeader } from "@/components/game/GameHeader";
import { HowToPlay } from "@/components/game/HowToPlay";
import { useState, useCallback, useEffect } from "react";
import heroImg from "@/assets/game-farkle.jpg";
import { useMultiplayer } from "@/hooks/useMultiplayer";
import { MultiplayerLobby } from "@/components/multiplayer/MultiplayerLobby";
import { WaitingRoom } from "@/components/multiplayer/WaitingRoom";
import { OpponentPanel, FinishBanner } from "@/components/multiplayer/OpponentPanel";
import { useAuth } from "@/contexts/AuthContext";
import { useGameEconomy } from "@/components/game/GameEconomyGate";

// ─── Game helpers ────────────────────────────────────────────────────────────
function rollDice(n: number) { return Array.from({ length: n }, () => Math.floor(Math.random() * 6) + 1); }

function scoreDice(dice: number[]): number {
  let s = 0;
  const counts = Array(7).fill(0);
  dice.forEach((d) => counts[d]++);
  if (counts[1]) s += counts[1] * 100;
  if (counts[5]) s += counts[5] * 50;
  counts.forEach((c, i) => { if (c >= 3 && i !== 1 && i !== 5) s += i * 100; });
  return s;
}

const WIN_SCORE = 1000;

// ─── SVG Dice face ────────────────────────────────────────────────────────────
const PIP_LAYOUT: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 22], [72, 22], [28, 50], [72, 50], [28, 78], [72, 78]],
};

function Die({
  value,
  scoring,
  kept,
  rolling,
  onClick,
}: {
  value: number;
  scoring: boolean;
  kept: boolean;
  rolling: boolean;
  onClick?: () => void;
}) {
  const pips = PIP_LAYOUT[value] ?? [];
  const bg   = kept ? "#16a34a" : scoring ? "#1d4ed8" : "#1e1e2e";
  const ring = kept ? "#22c55e" : scoring ? "#3b82f6" : "#444466";
  return (
    <button
      onClick={onClick}
      disabled={!onClick || kept || !scoring || rolling}
      className={[
        "relative transition-all duration-200 rounded-2xl",
        rolling ? "animate-bounce" : "",
        scoring && !kept && !rolling ? "hover:scale-110 hover:-translate-y-1 cursor-pointer" : "",
        kept ? "opacity-60 cursor-not-allowed" : "",
        !scoring && !kept ? "opacity-40 cursor-not-allowed" : "",
      ].join(" ")}
      aria-label={`Die showing ${value}${scoring ? " (scoreable)" : ""}${kept ? " (kept)" : ""}`}
    >
      <svg viewBox="0 0 100 100" width={56} height={56} xmlns="http://www.w3.org/2000/svg">
        {/* Shadow */}
        <rect x="6" y="8" width="88" height="88" rx="16" fill="rgba(0,0,0,0.4)" />
        {/* Die body */}
        <rect x="4" y="4" width="88" height="88" rx="16" fill={bg} stroke={ring} strokeWidth="3" />
        {/* Highlight */}
        <rect x="8" y="8" width="40" height="20" rx="8" fill="rgba(255,255,255,0.08)" />
        {/* Pips */}
        {pips.map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="8" fill="white" />
        ))}
      </svg>
      {/* Scoreable indicator */}
      {scoring && !kept && !rolling && (
        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-400 text-[8px] font-bold flex items-center justify-center text-black">
          ✓
        </span>
      )}
    </button>
  );
}

// ─── Solo game ───────────────────────────────────────────────────────────────
function FarkleSolo() {
  const { t } = useLanguage();
  const { playSound } = useSound();
  const { diceRoll, diceSettle, diceScore, farkleBust } = useGameSounds();
  const { settleGameResult } = useGameEconomy();
  const [dice, setDice]           = useState<number[]>([]);
  const [kept, setKept]           = useState<number[]>([]);
  const [score, setScore]         = useState(0);
  const [roundScore, setRoundScore] = useState(0);
  const [rolling, setRolling]     = useState(false);

  const roll = useCallback(() => {
    setRolling(true); diceRoll();
    setTimeout(() => {
      const n = 6 - kept.length;
      const newDice = rollDice(n);
      setDice(newDice);
      const s = scoreDice(newDice);
      if (s === 0) { setTimeout(farkleBust, 300); setRoundScore(0); setDice([]); setKept([]); }
      setRolling(false);
    }, 500);
  }, [kept, playSound]);

  const keepDie = (idx: number) => {
    const die = dice[idx];
    if (die !== 1 && die !== 5) return;
    setKept([...kept, die]);
    setDice(dice.filter((_, i) => i !== idx));
    setRoundScore((s) => s + (die === 1 ? 100 : 50));
    diceScore();
  };

  const bank = () => {
    const newScore = score + roundScore;
    setScore(newScore);
    setRoundScore(0); setDice([]); setKept([]); diceScore();
    if (newScore >= WIN_SCORE) void settleGameResult("win", "Farkle");
  };
  const restart = () => { setScore(0); setRoundScore(0); setDice([]); setKept([]); diceRoll(); };

  return (
    <Card>
      <CardContent className="pt-6 text-center space-y-5">
        {/* Score row */}
        <div className="flex justify-center gap-4">
          <Badge className="text-base px-3 py-1">{t("farkle.total")}: {score} / {WIN_SCORE}</Badge>
          <Badge variant="secondary" className="text-base px-3 py-1">{t("farkle.round")}: {roundScore}</Badge>
        </div>

        {/* Active dice */}
        <div className="min-h-[72px]">
          <div className="flex justify-center gap-3 flex-wrap">
            {dice.map((d, i) => (
              <Die key={i} value={d} scoring={d === 1 || d === 5} kept={false} rolling={rolling} onClick={() => keepDie(i)} />
            ))}
            {rolling && dice.length === 0 && (
              <span className="text-5xl animate-spin self-center">🎲</span>
            )}
          </div>
        </div>

        {/* Kept dice */}
        {kept.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">{t("farkle.kept")}</p>
            <div className="flex justify-center gap-2 flex-wrap">
              {kept.map((d, i) => (
                <Die key={i} value={d} scoring={true} kept={true} rolling={false} />
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-center flex-wrap">
          <Button size="lg" onClick={roll} disabled={rolling} className="min-w-[100px]">
            {rolling ? "Rolling…" : t("farkle.roll")}
          </Button>
          <Button size="lg" variant="secondary" onClick={bank} disabled={roundScore === 0} className="min-w-[100px]">
            {t("farkle.bank")} +{roundScore}
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={restart}>Restart</Button>
      </CardContent>
    </Card>
  );
}

// ─── Multiplayer game ────────────────────────────────────────────────────────
function FarkleMultiplayer() {
  const { user } = useAuth();
  const { playSound } = useSound();
  const { diceRoll, diceScore, farkleBust } = useGameSounds();
  const mp = useMultiplayer("farkle");
  const [rolling, setRolling] = useState(false);

  // Local view of game state (kept in sync with DB)
  const gs    = mp.session?.game_state as Record<string, unknown> | null;
  const dice  = (gs?.dice  as number[]) ?? [];
  const kept  = (gs?.kept  as number[]) ?? [];
  const round = (gs?.roundScore as number) ?? 0;
  const scores: Record<string, number> = (gs?.scores as Record<string, number>) ?? {};
  const opponentPlayer = mp.opponents[0];
  const me   = mp.myPlayer;
  const myScore = scores[user?.id ?? ""] ?? 0;
  const oppScore = scores[opponentPlayer?.id ?? ""] ?? 0;

  // Sync opponent score badge from game_state
  const opponentWithScore = opponentPlayer
    ? { ...opponentPlayer, score: oppScore }
    : undefined;

  const nextPlayer = () => {
    const all = mp.session?.players ?? [];
    const other = all.find((p) => p.id !== user?.id);
    return other?.id ?? user?.id ?? "";
  };

  const buildState = useCallback((overrides: Record<string, unknown>) => ({
    dice:       dice,
    kept:       kept,
    roundScore: round,
    scores,
    ...overrides,
  }), [dice, kept, round, scores]);

  const roll = useCallback(() => {
    if (!mp.isMyTurn || rolling) return;
    setRolling(true); diceRoll();
    setTimeout(() => {
      const n = 6 - kept.length;
      const newDice = rollDice(n);
      const s = scoreDice(newDice);
      if (s === 0) {
        setTimeout(farkleBust, 300);
        // Farkle — lose round, pass turn
        mp.makeMove(buildState({ dice: [], kept: [], roundScore: 0 }), nextPlayer());
      } else {
        mp.makeMove(buildState({ dice: newDice }), user!.id);
      }
      setRolling(false);
    }, 500);
  }, [mp, rolling, kept, buildState, playSound, user]);

  const keepDie = useCallback((idx: number) => {
    if (!mp.isMyTurn) return;
    const die = dice[idx];
    if (die !== 1 && die !== 5) return;
    const newDice = dice.filter((_, i) => i !== idx);
    const newKept = [...kept, die];
    const bonus   = die === 1 ? 100 : 50;
    mp.makeMove(buildState({ dice: newDice, kept: newKept, roundScore: round + bonus }), user!.id);
    diceScore();
  }, [mp, dice, kept, round, buildState, playSound, user]);

  const bank = useCallback(() => {
    if (!mp.isMyTurn || round === 0) return;
    const newScores = { ...scores, [user!.id]: (scores[user!.id] ?? 0) + round };
    // Check win condition
    if (newScores[user!.id] >= WIN_SCORE) {
      mp.makeMove(buildState({ dice: [], kept: [], roundScore: 0, scores: newScores }), nextPlayer());
      mp.endGame(user!.id);
      diceScore();
      return;
    }
    mp.makeMove(buildState({ dice: [], kept: [], roundScore: 0, scores: newScores }), nextPlayer());
    diceScore();
  }, [mp, round, scores, buildState, playSound, user]);

  // ── Lobby / waiting ──────────────────────────────────────────────────────
  if (mp.status === "idle") {
    return (
      <MultiplayerLobby
        gameType="farkle"
        loading={mp.loading}
        onCreateRoom={mp.createRoom}
        onJoinRoom={mp.joinRoom}
      />
    );
  }
  if (mp.status === "waiting") {
    return (
      <WaitingRoom
        session={mp.session!}
        isHost={mp.isHost}
        onStart={() => mp.startGame({ dice: [], kept: [], roundScore: 0, scores: {} })}
        onLeave={mp.leaveRoom}
      />
    );
  }
  if (mp.status === "finished") {
    return (
      <FinishBanner
        winnerId={mp.session!.winner_id}
        myId={user?.id ?? ""}
        players={mp.session!.players.map((p) => ({ ...p, score: scores[p.id] ?? 0 }))}
        onRematch={mp.leaveRoom}
      />
    );
  }

  return (
    <div className="space-y-4">
      <OpponentPanel
        opponent={opponentWithScore}
        isOpponentTurn={!mp.isMyTurn}
        label={`Score: ${oppScore} / ${WIN_SCORE}`}
      />
      <Card className={mp.isMyTurn ? "border-primary" : "opacity-70"}>
        <CardContent className="pt-6 text-center space-y-4">
          <div className="flex justify-center gap-4">
            <Badge>{mp.isMyTurn ? "Your turn" : "Waiting…"}</Badge>
            <Badge variant="secondary">Your score: {myScore} / {WIN_SCORE}</Badge>
            <Badge variant="outline">Round: {round}</Badge>
          </div>
          <div className="flex justify-center gap-3 flex-wrap min-h-[72px]">
            {dice.map((d, i) => (
              <Die key={i} value={d} scoring={mp.isMyTurn && (d === 1 || d === 5)} kept={false}
                rolling={rolling} onClick={mp.isMyTurn ? () => keepDie(i) : undefined} />
            ))}
            {rolling && dice.length === 0 && <span className="text-5xl animate-spin self-center">🎲</span>}
          </div>
          {kept.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Kept:</p>
              <div className="flex justify-center gap-2 flex-wrap">
                {kept.map((d, i) => <Die key={i} value={d} scoring={true} kept={true} rolling={false} />)}
              </div>
            </div>
          )}
          <div className="flex gap-3 justify-center">
            <Button size="lg" onClick={roll} disabled={!mp.isMyTurn || rolling}>Roll</Button>
            <Button size="lg" variant="secondary" onClick={bank} disabled={!mp.isMyTurn || round === 0}>Bank {round}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function FarkleGame() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<"solo" | "multi">("solo");

  return (
    <Layout>
      <section className="mx-auto max-w-2xl px-4 py-10">
        <div className="relative mb-6 overflow-hidden rounded-2xl">
          <img src={heroImg} alt="" role="presentation" className="h-40 w-full object-cover sm:h-48" width={800} height={512} loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute bottom-4 start-4 end-4 text-center">
            <h1 className="text-3xl font-bold">{t("farkle.title")}</h1>
          </div>
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-lg overflow-hidden border mb-6">
          <button onClick={() => setMode("solo")}  className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "solo"  ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>🎮 Solo</button>
          <button onClick={() => setMode("multi")} className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "multi" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>👥 Online</button>
        </div>

        {mode === "solo" ? <FarkleSolo /> : <FarkleMultiplayer />}
      </section>
    </Layout>
  );
}
