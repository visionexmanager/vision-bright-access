import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useState, useCallback, useEffect } from "react";
import heroImg from "@/assets/game-earmaster.jpg";
import { useMultiplayer } from "@/hooks/useMultiplayer";
import { MultiplayerLobby } from "@/components/multiplayer/MultiplayerLobby";
import { WaitingRoom } from "@/components/multiplayer/WaitingRoom";
import { FinishBanner } from "@/components/multiplayer/OpponentPanel";
import { useAuth } from "@/contexts/AuthContext";
import { seededRng } from "@/systems/multiplayerSystem";

const NOTES_FREQ: Record<string, number> = { C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392, A4: 440, B4: 493.88 };
const NOTE_NAMES = Object.keys(NOTES_FREQ);
const TOTAL_ROUNDS = 10;

function playTone(freq: number) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1);
  } catch {}
}

function noteForRound(seed: number, round: number) {
  const rng = seededRng(seed + round * 313);
  return NOTE_NAMES[Math.floor(rng() * NOTE_NAMES.length) % NOTE_NAMES.length];
}

function EarBoard({
  target,
  score,
  round,
  feedback,
  disabled,
  onPlay,
  onGuess,
}: {
  target: string;
  score: number;
  round: number;
  feedback: string | null;
  disabled: boolean;
  onPlay: () => void;
  onGuess: (note: string) => void;
}) {
  const { t } = useLanguage();

  return (
    <>
      <div className="flex justify-center gap-4 mb-6">
        <Badge>⭐ {score}</Badge>
        <Badge variant="secondary">{t("earmaster.round")}: {round}</Badge>
      </div>
      <Card>
        <CardContent className="pt-6 text-center space-y-6">
          <Button size="lg" className="text-xl px-8 py-6" onClick={onPlay} disabled={disabled}>
            🔊 {t("earmaster.playNote")}
          </Button>
          {feedback && <p className="text-2xl font-bold">{feedback}</p>}
          <div className="flex flex-wrap justify-center gap-2">
            {NOTE_NAMES.map((note) => (
              <Button key={note} variant="outline" className="text-lg w-16 h-16 font-bold" onClick={() => onGuess(note)} disabled={disabled || !!feedback}>
                {note}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function MusicEarSolo() {
  const { playSound } = useSound();
  const [target, setTarget] = useState(() => NOTE_NAMES[Math.floor(Math.random() * NOTE_NAMES.length)]);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [feedback, setFeedback] = useState<string | null>(null);

  const playTarget = useCallback(() => {
    playTone(NOTES_FREQ[target]);
  }, [target]);

  const guess = (note: string) => {
    if (note === target) {
      setScore((s) => s + 100);
      playSound("success");
      setFeedback("✅");
    } else {
      setFeedback(`❌ ${target}`);
      playSound("navigate");
    }
    setTimeout(() => {
      setTarget(NOTE_NAMES[Math.floor(Math.random() * NOTE_NAMES.length)]);
      setRound((r) => r + 1);
      setFeedback(null);
    }, 1500);
  };

  return <EarBoard target={target} score={score} round={round} feedback={feedback} disabled={false} onPlay={playTarget} onGuess={guess} />;
}

function MusicEarMulti() {
  const { user } = useAuth();
  const { playSound } = useSound();
  const mp = useMultiplayer("earmaster");
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  const gs = mp.session?.game_state as Record<string, unknown> | null;
  const seed = (gs?.seed as number) ?? 1;
  const target = noteForRound(seed, round);
  const opp = mp.opponents[0];
  const oppScore = mp.session?.players.find((p) => p.id !== user?.id)?.score ?? 0;
  const bothDone = gs && user && opp ? gs[`fin_${user.id}`] === true && gs[`fin_${opp.id}`] === true : false;

  useEffect(() => {
    if (bothDone && mp.status === "playing") {
      const sorted = [...mp.session!.players].sort((a, b) => b.score - a.score);
      mp.endGame(sorted[0].score !== sorted[1]?.score ? sorted[0].id : undefined);
    }
  }, [bothDone, mp]);

  const playTarget = useCallback(() => {
    playTone(NOTES_FREQ[target]);
  }, [target]);

  const advance = (newScore: number) => {
    if (round >= TOTAL_ROUNDS) {
      setFinished(true);
      mp.updateMyScore(newScore, true);
      return;
    }
    setRound((r) => r + 1);
    setFeedback(null);
  };

  const guess = (note: string) => {
    if (finished || feedback) return;
    const correct = note === target;
    const newScore = correct ? score + 100 : score;
    setScore(newScore);
    mp.updateMyScore(newScore, false);
    setFeedback(correct ? "✅" : `❌ ${target}`);
    playSound(correct ? "success" : "navigate");
    setTimeout(() => advance(newScore), 1200);
  };

  if (mp.status === "idle")
    return <MultiplayerLobby gameType="earmaster" loading={mp.loading} onCreateRoom={mp.createRoom} onJoinRoom={mp.joinRoom} />;
  if (mp.status === "waiting")
    return <WaitingRoom session={mp.session!} isHost={mp.isHost} onStart={() => mp.startGame({ seed: Math.floor(Math.random() * 999999) })} onLeave={mp.leaveRoom} />;
  if (mp.status === "finished")
    return <FinishBanner winnerId={mp.session!.winner_id} myId={user?.id ?? ""} players={mp.session!.players} onRematch={mp.leaveRoom} />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between rounded-lg border p-3 text-sm">
        <div className="text-center"><p className="text-xs text-muted-foreground">You</p><p className="text-xl font-bold text-primary">{score}</p></div>
        <Badge variant="outline">{round}/{TOTAL_ROUNDS}</Badge>
        <div className="text-center"><p className="text-xs text-muted-foreground">{opp?.name ?? "Opponent"}</p><p className="text-xl font-bold">{oppScore}</p></div>
      </div>
      {finished ? (
        <Card><CardContent className="pt-6 text-center space-y-2">
          <p className="text-xl font-bold">Done! ✅</p>
          <p className="text-muted-foreground">Score: {score} — Waiting for opponent…</p>
        </CardContent></Card>
      ) : (
        <EarBoard target={target} score={score} round={round} feedback={feedback} disabled={false} onPlay={playTarget} onGuess={guess} />
      )}
    </div>
  );
}

export default function MusicEarMaster() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<"solo" | "multi">("solo");

  return (
    <Layout>
      <section className="mx-auto max-w-2xl px-4 py-10">
        <div className="relative mb-6 overflow-hidden rounded-2xl">
          <img src={heroImg} alt="" role="presentation" className="h-40 w-full object-cover sm:h-48" width={800} height={512} loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 text-center">
            <h1 className="text-3xl font-bold">🎵 {t("earmaster.title")}</h1>
          </div>
        </div>
        <div className="flex rounded-lg overflow-hidden border mb-6">
          <button onClick={() => setMode("solo")} className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "solo" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>🎮 Solo</button>
          <button onClick={() => setMode("multi")} className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "multi" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>👥 Online</button>
        </div>
        {mode === "solo" ? <MusicEarSolo /> : <MusicEarMulti />}
      </section>
    </Layout>
  );
}
