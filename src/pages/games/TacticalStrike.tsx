import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useGameSounds } from "@/hooks/useGameSounds";
import { useHighScore } from "@/hooks/useHighScore";
import { GameHeader } from "@/components/game/GameHeader";
import { HowToPlay } from "@/components/game/HowToPlay";
import { useState, useEffect, useCallback } from "react";
import heroImg from "@/assets/game-tactical.jpg";
import { useMultiplayer } from "@/hooks/useMultiplayer";
import { MultiplayerLobby } from "@/components/multiplayer/MultiplayerLobby";
import { WaitingRoom } from "@/components/multiplayer/WaitingRoom";
import { FinishBanner } from "@/components/multiplayer/OpponentPanel";
import { useAuth } from "@/contexts/AuthContext";
import { seededRng } from "@/systems/multiplayerSystem";

const TARGETS = ["🎯", "💣", "⭐", "🎯", "💣", "⭐", "🎯", "💣"];
const RARE_GIFT = "🎁";
const ROUND_SECONDS = 25;
const GRID_REFRESH_MS = 3500; // was 2000 — now slower

function buildGrid(seed: number) {
  const rng = seededRng(seed);
  return Array(16).fill("").map(() => {
    if (rng() < 0.04) return RARE_GIFT; // 4% chance gift
    return TARGETS[Math.floor(rng() * TARGETS.length) % TARGETS.length];
  });
}

function StrikeGrid({ grid, onHit, hit }: { grid: string[]; onHit: (idx: number) => void; hit: number | null }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-4 gap-2">
          {grid.map((cell, i) => (
            <Button
              key={i}
              variant="outline"
              className={`h-16 text-3xl transition-all active:scale-75 hover:bg-primary/10 ${hit === i ? "opacity-30 scale-90" : ""}`}
              onClick={() => onHit(i)}
            >
              {cell}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Solo ──────────────────────────────────────────────────────────────────────
function TacticalSolo() {
  const { t } = useLanguage();
  const { playSound } = useSound();
  const { tacticalHit, tacticalMiss, tacticalExplosion } = useGameSounds();
  const { highScore, updateHighScore } = useHighScore("tactical");

  const [grid, setGrid] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [active, setActive] = useState(false);
  const [lastHit, setLastHit] = useState<number | null>(null);
  const [comboMsg, setComboMsg] = useState("");
  const [newRecord, setNewRecord] = useState(false);

  const shuffle = useCallback(() => setGrid(buildGrid(Math.floor(Math.random() * 999999))), []);

  const start = () => {
    setScore(0); setCombo(0); setTimeLeft(ROUND_SECONDS);
    setActive(true); shuffle(); setNewRecord(false);
    playSound("start");
  };

  // Timer
  useEffect(() => {
    if (!active || timeLeft <= 0) return;
    const timer = setTimeout(() => setTimeLeft(v => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [active, timeLeft]);

  // Game over
  useEffect(() => {
    if (timeLeft <= 0 && active) {
      setActive(false);
      const isNew = updateHighScore(score);
      setNewRecord(isNew);
    }
  }, [timeLeft, active]);

  // Grid refresh every 3.5s
  useEffect(() => {
    if (active) {
      const i = setInterval(shuffle, GRID_REFRESH_MS);
      return () => clearInterval(i);
    }
  }, [active, shuffle]);

  const hit = (idx: number) => {
    if (!active) return;
    const target = grid[idx];
    setLastHit(idx);
    setTimeout(() => setLastHit(null), 300);

    let pts = 0;
    if (target === "🎯") { pts = 10; tacticalHit(); }
    else if (target === "⭐") { pts = 25; tacticalExplosion(); }
    else if (target === RARE_GIFT) { pts = 75; tacticalExplosion(); }
    else { setCombo(0); setComboMsg(""); setScore(s => Math.max(0, s - 15)); tacticalMiss(); return; }

    const newCombo = combo + 1;
    setCombo(newCombo);
    const multiplier = newCombo >= 5 ? 3 : newCombo >= 3 ? 2 : newCombo >= 2 ? 1.5 : 1;
    const finalPts = Math.round(pts * multiplier);
    setScore(s => s + finalPts);

    if (newCombo >= 2) {
      setComboMsg(t("tactical.combo").replace("{n}", String(Math.floor(multiplier))));
      setTimeout(() => setComboMsg(""), 1500);
    }
  };

  if (!active && timeLeft === ROUND_SECONDS) {
    return (
      <Card><CardContent className="pt-6 text-center space-y-4">
        <p className="text-5xl">🎯</p>
        <Button size="lg" onClick={start}>{t("tactical.start")}</Button>
      </CardContent></Card>
    );
  }

  if (!active) {
    return (
      <Card><CardContent className="pt-6 text-center space-y-4">
        <p className="text-5xl">🏆</p>
        {newRecord && <p className="text-primary font-bold animate-bounce">{t("games.newRecord")}</p>}
        <p className="text-2xl font-bold">{t("tactical.finalScore")}: {score}</p>
        <p className="text-muted-foreground">{t("games.highScore")}: {highScore}</p>
        <Button size="lg" onClick={start}>{t("tactical.restart")}</Button>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-center gap-4 flex-wrap">
        <Badge>⭐ {score}</Badge>
        <Badge variant={timeLeft < 5 ? "destructive" : "secondary"}>⏱️ {timeLeft}s</Badge>
        {combo >= 2 && <Badge className="bg-orange-500 animate-pulse">{t("tactical.combo").replace("{n}", String(combo))}</Badge>}
      </div>
      {comboMsg && (
        <p className="text-center font-bold text-orange-500 animate-in zoom-in-95 duration-200">{comboMsg}</p>
      )}
      <StrikeGrid grid={grid} onHit={hit} hit={lastHit} />
    </div>
  );
}

// ─── Multiplayer ────────────────────────────────────────────────────────────────
function TacticalMulti() {
  const { user } = useAuth();
  const { playSound } = useSound();
  const { tacticalHit, tacticalMiss, tacticalExplosion } = useGameSounds();
  const mp = useMultiplayer("tactical");
  const [grid, setGrid] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [finished, setFinished] = useState(false);
  const [lastHit, setLastHit] = useState<number | null>(null);

  const gs = mp.session?.game_state as Record<string, unknown> | null;
  const seed = (gs?.seed as number) ?? 1;
  const opp = mp.opponents[0];
  const oppScore = mp.session?.players.find(p => p.id !== user?.id)?.score ?? 0;
  const bothDone = gs && user && opp
    ? gs[`fin_${user.id}`] === true && gs[`fin_${opp.id}`] === true : false;

  useEffect(() => {
    if (mp.status === "playing") setGrid(buildGrid(seed));
  }, [mp.status, seed]);

  useEffect(() => {
    if (!mp.status || mp.status !== "playing" || finished || timeLeft <= 0) return;
    const timer = setTimeout(() => setTimeLeft(v => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, finished, mp.status]);

  useEffect(() => {
    if (timeLeft <= 0 && !finished && mp.status === "playing") {
      setFinished(true);
      mp.updateMyScore(score, true);
    }
  }, [timeLeft, finished]);

  useEffect(() => {
    if (mp.status === "playing" && !finished) {
      const i = setInterval(() => setGrid(buildGrid(seed + Date.now())), GRID_REFRESH_MS);
      return () => clearInterval(i);
    }
  }, [mp.status, finished, seed]);

  useEffect(() => {
    if (bothDone && mp.status === "playing") {
      const sorted = [...mp.session!.players].sort((a, b) => b.score - a.score);
      mp.endGame(sorted[0].score !== sorted[1]?.score ? sorted[0].id : undefined);
    }
  }, [bothDone]);

  const hit = (idx: number) => {
    if (!mp.status || finished) return;
    const target = grid[idx];
    setLastHit(idx);
    setTimeout(() => setLastHit(null), 300);

    let pts = 0;
    if (target === "🎯") { pts = 10; tacticalHit(); }
    else if (target === "⭐") { pts = 25; tacticalExplosion(); }
    else if (target === RARE_GIFT) { pts = 75; tacticalExplosion(); }
    else { setCombo(0); setScore(s => Math.max(0, s - 15)); tacticalMiss(); return; }

    const newCombo = combo + 1;
    setCombo(newCombo);
    const multiplier = newCombo >= 5 ? 3 : newCombo >= 3 ? 2 : newCombo >= 2 ? 1.5 : 1;
    const ns = score + Math.round(pts * multiplier);
    setScore(ns);
    mp.updateMyScore(ns, false);
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
        <div className="text-center"><p className="text-xs text-muted-foreground">{opp?.name}</p><p className="text-xl font-bold">{oppScore}</p></div>
      </div>
      {finished
        ? <Card><CardContent className="pt-6 text-center"><p className="font-bold">Done! Waiting…</p></CardContent></Card>
        : <StrikeGrid grid={grid} onHit={hit} hit={lastHit} />}
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────────
export default function TacticalStrike() {
  const { t } = useLanguage();
  const { highScore } = useHighScore("tactical");
  const [mode, setMode] = useState<"solo" | "multi">("solo");

  return (
    <Layout>
      <section className="mx-auto max-w-2xl px-4 py-10">
        <div className="relative mb-6 overflow-hidden rounded-2xl">
          <img src={heroImg} alt="" role="presentation" className="h-40 w-full object-cover sm:h-48" width={800} height={512} loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute bottom-4 start-4 end-4 text-center">
            <h1 className="text-3xl font-bold">🎯 {t("tactical.title")}</h1>
          </div>
        </div>
        <GameHeader
          title={t("tactical.title")}
          highScore={highScore}
          extra={
            <HowToPlay
              titleKey="tactical.title"
              steps={["tactical.howTo.1","tactical.howTo.2","tactical.howTo.3","tactical.howTo.4","tactical.howTo.5"]}
            />
          }
        />
        <div className="flex rounded-lg overflow-hidden border mb-6">
          <button onClick={() => setMode("solo")}  className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "solo"  ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>🎮 Solo</button>
          <button onClick={() => setMode("multi")} className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "multi" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>👥 Online</button>
        </div>
        {mode === "solo" ? <TacticalSolo /> : <TacticalMulti />}
      </section>
    </Layout>
  );
}
