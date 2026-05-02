import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useState, useEffect, useCallback } from "react";
import heroImg from "@/assets/game-neonbreach.jpg";
import { useMultiplayer } from "@/hooks/useMultiplayer";
import { MultiplayerLobby } from "@/components/multiplayer/MultiplayerLobby";
import { WaitingRoom } from "@/components/multiplayer/WaitingRoom";
import { FinishBanner } from "@/components/multiplayer/OpponentPanel";
import { useAuth } from "@/contexts/AuthContext";
import { seededRng } from "@/systems/multiplayerSystem";

const FIREWALL_NODES = ["🔒", "🛡️", "⚡", "🔑", "💾", "🌐", "📡", "🔓"];

// ─── Solo ────────────────────────────────────────────────────────────────────
function NeonBreachSolo() {
  const { t } = useLanguage();
  const { playSound } = useSound();
  const [sequence, setSequence] = useState<number[]>([]);
  const [playerSeq, setPlayerSeq] = useState<number[]>([]);
  const [level, setLevel]   = useState(1);
  const [score, setScore]   = useState(0);
  const [phase, setPhase]   = useState<"showing" | "input" | "gameover">("showing");
  const [showIdx, setShowIdx] = useState(-1);

  const startLevel = useCallback((lvl: number) => {
    const seq = Array.from({ length: lvl + 2 }, () => Math.floor(Math.random() * FIREWALL_NODES.length));
    setSequence(seq); setPlayerSeq([]); setPhase("showing"); setShowIdx(0);
  }, []);

  useEffect(() => { startLevel(1); }, [startLevel]);

  useEffect(() => {
    if (phase !== "showing" || showIdx < 0) return;
    if (showIdx >= sequence.length) { setPhase("input"); setShowIdx(-1); return; }
    const t = setTimeout(() => setShowIdx((i) => i + 1), 600);
    return () => clearTimeout(t);
  }, [phase, showIdx, sequence.length]);

  const tap = (idx: number) => {
    if (phase !== "input") return;
    const next = [...playerSeq, idx];
    setPlayerSeq(next);
    if (idx !== sequence[next.length - 1]) { setPhase("gameover"); playSound("navigate"); return; }
    playSound("success");
    if (next.length === sequence.length) {
      setScore((s) => s + level * 50); setLevel((l) => l + 1);
      setTimeout(() => startLevel(level + 1), 500);
    }
  };

  const restart = () => { setLevel(1); setScore(0); startLevel(1); playSound("start"); };

  return (
    <div className="space-y-4">
      <div className="flex justify-center gap-4">
        <Badge>⭐ {score}</Badge>
        <Badge variant="secondary">{t("neonbreach.level")}: {level}</Badge>
      </div>
      {phase === "gameover" ? (
        <Card><CardContent className="pt-6 text-center space-y-4">
          <p className="text-5xl">🔥</p>
          <p className="text-2xl font-bold">{t("neonbreach.breached")}</p>
          <p>{t("neonbreach.finalScore")}: {score}</p>
          <Button size="lg" onClick={restart}>{t("neonbreach.restart")}</Button>
        </CardContent></Card>
      ) : (
        <Card><CardContent className="pt-6 space-y-6">
          <p className="text-center text-muted-foreground">
            {phase === "showing" ? t("neonbreach.memorize") : t("neonbreach.repeat")}
          </p>
          <div className="grid grid-cols-4 gap-3">
            {FIREWALL_NODES.map((node, i) => (
              <Button key={i} variant="outline"
                className={`text-3xl h-16 transition-all ${phase === "showing" && showIdx >= 0 && sequence[showIdx] === i ? "bg-primary text-primary-foreground scale-110" : ""}`}
                disabled={phase !== "input"} onClick={() => tap(i)}>{node}</Button>
            ))}
          </div>
          <Progress value={(playerSeq.length / sequence.length) * 100} />
        </CardContent></Card>
      )}
    </div>
  );
}

// ─── Multiplayer (competitive — same seeded sequence) ────────────────────────
function NeonBreachMulti() {
  const { user } = useAuth();
  const { playSound } = useSound();
  const mp = useMultiplayer("neonbreach");

  const [sequence, setSequence] = useState<number[]>([]);
  const [playerSeq, setPlayerSeq] = useState<number[]>([]);
  const [level, setLevel]   = useState(1);
  const [myScore, setMyScore] = useState(0);
  const [phase, setPhase]   = useState<"showing" | "input" | "eliminated">("showing");
  const [showIdx, setShowIdx] = useState(-1);
  const [started, setStarted] = useState(false);

  const gs      = mp.session?.game_state as Record<string, unknown> | null;
  const seed    = (gs?.seed as number) ?? 42;
  const opp     = mp.opponents[0];
  const oppScore = mp.session?.players.find((p) => p.id !== user?.id)?.score ?? 0;
  const oppElim  = gs ? gs[`fin_${opp?.id ?? ""}`] === true : false;

  // Build seeded sequence for this level
  const buildSeq = useCallback((lvl: number, s: number) => {
    const rng = seededRng(s * 1000 + lvl);
    return Array.from({ length: lvl + 2 }, () => Math.floor(rng() * FIREWALL_NODES.length));
  }, []);

  // When game starts (status flips to playing), begin level 1
  useEffect(() => {
    if (mp.status === "playing" && !started) {
      setStarted(true);
      const seq = buildSeq(1, seed);
      setSequence(seq); setPhase("showing"); setShowIdx(0);
    }
  }, [mp.status, started, seed, buildSeq]);

  // Show sequence animation
  useEffect(() => {
    if (phase !== "showing" || showIdx < 0) return;
    if (showIdx >= sequence.length) { setPhase("input"); setShowIdx(-1); return; }
    const t = setTimeout(() => setShowIdx((i) => i + 1), 600);
    return () => clearTimeout(t);
  }, [phase, showIdx, sequence.length]);

  // Check if opponent eliminated → auto-end if both eliminated
  useEffect(() => {
    if (phase === "eliminated" && oppElim && mp.status === "playing") {
      const allPlayers = mp.session!.players;
      const sorted = [...allPlayers].sort((a, b) => b.score - a.score);
      const winnerId = sorted[0].score !== sorted[1]?.score ? sorted[0].id : undefined;
      mp.endGame(winnerId);
    }
  }, [phase, oppElim, mp]);

  const tap = (idx: number) => {
    if (phase !== "input") return;
    const next = [...playerSeq, idx];
    setPlayerSeq(next);
    if (idx !== sequence[next.length - 1]) {
      // Eliminated
      setPhase("eliminated");
      playSound("navigate");
      mp.updateMyScore(myScore, true);
      if (oppElim) {
        const allPlayers = mp.session!.players;
        const sorted = [...allPlayers].sort((a, b) => b.score - a.score);
        mp.endGame(sorted[0].score !== sorted[1]?.score ? sorted[0].id : undefined);
      }
      return;
    }
    playSound("success");
    if (next.length === sequence.length) {
      const newScore = myScore + level * 50;
      const newLevel = level + 1;
      setMyScore(newScore);
      setLevel(newLevel);
      mp.updateMyScore(newScore, false);
      const seq = buildSeq(newLevel, seed);
      setTimeout(() => { setSequence(seq); setPlayerSeq([]); setPhase("showing"); setShowIdx(0); }, 500);
    }
  };

  if (mp.status === "idle")
    return <MultiplayerLobby gameType="neonbreach" loading={mp.loading} onCreateRoom={mp.createRoom} onJoinRoom={mp.joinRoom} />;
  if (mp.status === "waiting")
    return <WaitingRoom session={mp.session!} isHost={mp.isHost}
      onStart={() => mp.startGame({ seed: Math.floor(Math.random() * 9999) })} onLeave={mp.leaveRoom} />;
  if (mp.status === "finished")
    return <FinishBanner winnerId={mp.session!.winner_id} myId={user?.id ?? ""} players={mp.session!.players} onRematch={mp.leaveRoom} />;

  return (
    <div className="space-y-4">
      {/* Live scoreboard */}
      <div className="flex justify-between rounded-lg border p-3 text-sm">
        <div className="text-center">
          <p className="text-xs text-muted-foreground">You</p>
          <p className="text-xl font-bold text-primary">{myScore}</p>
          <Badge variant="secondary" className="text-xs">Lv {level}</Badge>
        </div>
        <div className="text-center self-center text-muted-foreground">VS</div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">{opp?.name ?? "Opponent"}</p>
          <p className="text-xl font-bold">{oppScore}</p>
          {oppElim && <Badge variant="destructive" className="text-xs">Out</Badge>}
        </div>
      </div>

      {phase === "eliminated" ? (
        <Card><CardContent className="pt-6 text-center space-y-3">
          <p className="text-4xl">🔥</p>
          <p className="text-xl font-bold">You were breached!</p>
          <p className="text-muted-foreground">Score: {myScore} — Waiting for opponent…</p>
        </CardContent></Card>
      ) : (
        <Card><CardContent className="pt-6 space-y-6">
          <p className="text-center text-muted-foreground">
            {phase === "showing" ? "Memorize the sequence…" : "Repeat it!"}
          </p>
          <div className="grid grid-cols-4 gap-3">
            {FIREWALL_NODES.map((node, i) => (
              <Button key={i} variant="outline"
                className={`text-3xl h-16 transition-all ${phase === "showing" && showIdx >= 0 && sequence[showIdx] === i ? "bg-primary text-primary-foreground scale-110" : ""}`}
                disabled={phase !== "input"} onClick={() => tap(i)}>{node}</Button>
            ))}
          </div>
          <Progress value={(playerSeq.length / Math.max(sequence.length, 1)) * 100} />
        </CardContent></Card>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function NeonBreach() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<"solo" | "multi">("solo");

  return (
    <Layout>
      <section className="mx-auto max-w-2xl px-4 py-10">
        <div className="relative mb-6 overflow-hidden rounded-2xl">
          <img src={heroImg} alt="" role="presentation" className="h-40 w-full object-cover sm:h-48" width={800} height={512} loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 text-center">
            <h1 className="text-3xl font-bold">💻 {t("neonbreach.title")}</h1>
          </div>
        </div>
        <div className="flex rounded-lg overflow-hidden border mb-6">
          <button onClick={() => setMode("solo")}  className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "solo"  ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>🎮 Solo</button>
          <button onClick={() => setMode("multi")} className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "multi" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>👥 Online</button>
        </div>
        {mode === "solo" ? <NeonBreachSolo /> : <NeonBreachMulti />}
      </section>
    </Layout>
  );
}
