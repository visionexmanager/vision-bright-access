import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useState, useEffect, useCallback } from "react";
import heroImg from "@/assets/game-tactical.jpg";
import { useMultiplayer } from "@/hooks/useMultiplayer";
import { MultiplayerLobby } from "@/components/multiplayer/MultiplayerLobby";
import { WaitingRoom } from "@/components/multiplayer/WaitingRoom";
import { FinishBanner } from "@/components/multiplayer/OpponentPanel";
import { useAuth } from "@/contexts/AuthContext";
import { seededRng } from "@/systems/multiplayerSystem";

const TARGETS = ["🎯", "💣", "⭐", "🎯", "💣", "⭐", "🎯", "💣"];
const ROUND_SECONDS = 20;

function buildGrid(seed: number) {
  const rng = seededRng(seed);
  return Array(16).fill("").map(() => TARGETS[Math.floor(rng() * TARGETS.length) % TARGETS.length]);
}

function StrikeGrid({ grid, onHit }: { grid: string[]; onHit: (idx: number) => void }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-4 gap-2">
          {grid.map((cell, i) => (
            <Button key={i} variant="outline" className="h-16 text-3xl" onClick={() => onHit(i)}>{cell}</Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TacticalSolo() {
  const { t } = useLanguage();
  const { playSound } = useSound();
  const [grid, setGrid] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [active, setActive] = useState(false);

  const shuffle = useCallback(() => setGrid(buildGrid(Math.floor(Math.random() * 999999))), []);
  const start = () => { setScore(0); setTimeLeft(ROUND_SECONDS); setActive(true); shuffle(); playSound("start"); };

  useEffect(() => {
    if (!active || timeLeft <= 0) return;
    const timer = setTimeout(() => setTimeLeft((v) => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [active, timeLeft]);

  useEffect(() => { if (timeLeft <= 0 && active) setActive(false); }, [timeLeft, active]);
  useEffect(() => { if (active) { const i = setInterval(shuffle, 2000); return () => clearInterval(i); } }, [active, shuffle]);

  const hit = (idx: number) => {
    if (!active) return;
    const target = grid[idx];
    if (target === "🎯") { setScore((s) => s + 10); playSound("success"); }
    else if (target === "⭐") { setScore((s) => s + 25); playSound("success"); }
    else { setScore((s) => s - 15); playSound("navigate"); }
    setGrid((g) => g.map((v, i) => (i === idx ? "💥" : v)));
  };

  if (!active && timeLeft === ROUND_SECONDS)
    return <Card><CardContent className="pt-6 text-center"><Button size="lg" onClick={start}>{t("tactical.start")}</Button></CardContent></Card>;
  if (!active)
    return <Card><CardContent className="pt-6 text-center space-y-4"><p className="text-5xl">🏆</p><p className="text-2xl font-bold">{t("tactical.finalScore")}: {score}</p><Button size="lg" onClick={start}>{t("tactical.restart")}</Button></CardContent></Card>;

  return (
    <>
      <div className="flex justify-center gap-4 mb-6">
        <Badge>⭐ {score}</Badge>
        <Badge variant={timeLeft < 5 ? "destructive" : "secondary"}>⏱️ {timeLeft}s</Badge>
      </div>
      <StrikeGrid grid={grid} onHit={hit} />
    </>
  );
}

function TacticalMulti() {
  const { user } = useAuth();
  const { playSound } = useSound();
  const mp = useMultiplayer("tactical");
  const [grid, setGrid] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [finished, setFinished] = useState(false);
  const gs = mp.session?.game_state as Record<string, unknown> | null;
  const seed = (gs?.seed as number) ?? 1;
  const opp = mp.opponents[0];
  const oppScore = mp.session?.players.find((p) => p.id !== user?.id)?.score ?? 0;
  const bothDone = gs && user && opp ? gs[`fin_${user.id}`] === true && gs[`fin_${opp.id}`] === true : false;

  useEffect(() => {
    if (mp.status === "playing") setGrid(buildGrid(seed));
  }, [mp.status, seed]);

  useEffect(() => {
    if (mp.status !== "playing" || finished || timeLeft <= 0) return;
    const timer = setTimeout(() => setTimeLeft((v) => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [mp.status, finished, timeLeft]);

  useEffect(() => {
    if (mp.status !== "playing" || finished) return;
    const tickSeed = seed + Math.floor((ROUND_SECONDS - timeLeft) / 2) * 101;
    setGrid(buildGrid(tickSeed));
  }, [timeLeft, seed, mp.status, finished]);

  useEffect(() => {
    if (timeLeft <= 0 && mp.status === "playing" && !finished) {
      setFinished(true);
      mp.updateMyScore(score, true);
    }
  }, [timeLeft, finished, mp, score]);

  useEffect(() => {
    if (bothDone && mp.status === "playing") {
      const sorted = [...mp.session!.players].sort((a, b) => b.score - a.score);
      mp.endGame(sorted[0].score !== sorted[1]?.score ? sorted[0].id : undefined);
    }
  }, [bothDone, mp]);

  const hit = (idx: number) => {
    if (finished || mp.status !== "playing") return;
    const target = grid[idx];
    const delta = target === "🎯" ? 10 : target === "⭐" ? 25 : -15;
    const nextScore = score + delta;
    setScore(nextScore);
    mp.updateMyScore(nextScore, false);
    playSound(delta > 0 ? "success" : "navigate");
    setGrid((g) => g.map((v, i) => (i === idx ? "💥" : v)));
  };

  if (mp.status === "idle")
    return <MultiplayerLobby gameType="tactical" loading={mp.loading} onCreateRoom={mp.createRoom} onJoinRoom={mp.joinRoom} />;
  if (mp.status === "waiting")
    return <WaitingRoom session={mp.session!} isHost={mp.isHost} onStart={() => mp.startGame({ seed: Math.floor(Math.random() * 999999) })} onLeave={mp.leaveRoom} />;
  if (mp.status === "finished")
    return <FinishBanner winnerId={mp.session!.winner_id} myId={user?.id ?? ""} players={mp.session!.players} onRematch={mp.leaveRoom} />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between rounded-lg border p-3 text-sm">
        <div className="text-center"><p className="text-xs text-muted-foreground">You</p><p className="text-xl font-bold text-primary">{score}</p></div>
        <Badge variant={timeLeft < 5 ? "destructive" : "secondary"}>⏱️ {timeLeft}s</Badge>
        <div className="text-center"><p className="text-xs text-muted-foreground">{opp?.name ?? "Opponent"}</p><p className="text-xl font-bold">{oppScore}</p></div>
      </div>
      {finished ? (
        <Card><CardContent className="pt-6 text-center space-y-2"><p className="text-xl font-bold">Done! ✅</p><p className="text-muted-foreground">Score: {score} — Waiting for opponent…</p></CardContent></Card>
      ) : (
        <StrikeGrid grid={grid} onHit={hit} />
      )}
    </div>
  );
}

export default function TacticalStrike() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<"solo" | "multi">("solo");

  return (
    <Layout>
      <section className="mx-auto max-w-2xl px-4 py-10">
        <div className="relative mb-6 overflow-hidden rounded-2xl">
          <img src={heroImg} alt="" role="presentation" className="h-40 w-full object-cover sm:h-48" width={800} height={512} loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 text-center">
            <h1 className="text-3xl font-bold">🎯 {t("tactical.title")}</h1>
          </div>
        </div>
        <div className="flex rounded-lg overflow-hidden border mb-6">
          <button onClick={() => setMode("solo")} className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "solo" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>🎮 Solo</button>
          <button onClick={() => setMode("multi")} className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "multi" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>👥 Online</button>
        </div>
        {mode === "solo" ? <TacticalSolo /> : <TacticalMulti />}
      </section>
    </Layout>
  );
}
