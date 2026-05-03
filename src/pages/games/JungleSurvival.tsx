import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useState, useCallback, useEffect } from "react";
import heroImg from "@/assets/game-jungle.jpg";
import { useMultiplayer } from "@/hooks/useMultiplayer";
import { MultiplayerLobby } from "@/components/multiplayer/MultiplayerLobby";
import { WaitingRoom } from "@/components/multiplayer/WaitingRoom";
import { FinishBanner } from "@/components/multiplayer/OpponentPanel";
import { useAuth } from "@/contexts/AuthContext";

const SCENARIOS = [
  { text: "jungle.scene1", choices: [{ key: "jungle.s1c1", hp: -10, score: 20 }, { key: "jungle.s1c2", hp: 5, score: 10 }] },
  { text: "jungle.scene2", choices: [{ key: "jungle.s2c1", hp: -20, score: 30 }, { key: "jungle.s2c2", hp: -5, score: 15 }] },
  { text: "jungle.scene3", choices: [{ key: "jungle.s3c1", hp: 10, score: 25 }, { key: "jungle.s3c2", hp: -15, score: 35 }] },
  { text: "jungle.scene4", choices: [{ key: "jungle.s4c1", hp: -25, score: 40 }, { key: "jungle.s4c2", hp: 0, score: 20 }] },
  { text: "jungle.scene5", choices: [{ key: "jungle.s5c1", hp: -10, score: 50 }, { key: "jungle.s5c2", hp: 5, score: 30 }] },
];

type Choice = { hp: number; score: number };

function JungleBoard({
  step,
  hp,
  score,
  gameOver,
  onChoose,
  onRestart,
}: {
  step: number;
  hp: number;
  score: number;
  gameOver: boolean;
  onChoose: (choice: Choice) => void;
  onRestart?: () => void;
}) {
  const { t } = useLanguage();
  const scene = SCENARIOS[Math.min(step, SCENARIOS.length - 1)];

  return (
    <>
      <div className="flex justify-center gap-4 mb-6">
        <Badge variant={hp < 30 ? "destructive" : "secondary"}>❤️ {hp}/100</Badge>
        <Badge>⭐ {score}</Badge>
      </div>
      <Card>
        <CardContent className="pt-6 space-y-6">
          {!gameOver ? (
            <>
              <p className="text-lg text-center leading-relaxed">{t(scene.text)}</p>
              <div className="grid gap-3">
                {scene.choices.map((choice, i) => (
                  <Button key={i} size="lg" variant={i === 0 ? "default" : "outline"} className="text-base h-auto py-4 whitespace-normal" onClick={() => onChoose(choice)}>
                    {t(choice.key)}
                  </Button>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center space-y-4">
              <p className="text-5xl">{hp > 0 ? "🏆" : "💀"}</p>
              <p className="text-2xl font-bold">{hp > 0 ? t("jungle.survived") : t("jungle.died")}</p>
              <p className="text-lg">{t("jungle.finalScore")}: {score}</p>
              {onRestart && <Button size="lg" onClick={onRestart}>{t("jungle.restart")}</Button>}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function JungleSolo() {
  const { playSound } = useSound();
  const [step, setStep] = useState(0);
  const [hp, setHp] = useState(100);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  const choose = useCallback((choice: Choice) => {
    const newHp = Math.min(100, hp + choice.hp);
    setHp(newHp);
    setScore((s) => s + choice.score);
    if (newHp <= 0) { setGameOver(true); playSound("navigate"); return; }
    if (step + 1 >= SCENARIOS.length) { setGameOver(true); playSound("success"); return; }
    setStep((s) => s + 1);
    playSound(choice.hp >= 0 ? "success" : "navigate");
  }, [hp, step, playSound]);

  const restart = () => { setStep(0); setHp(100); setScore(0); setGameOver(false); playSound("start"); };
  return <JungleBoard step={step} hp={hp} score={score} gameOver={gameOver} onChoose={choose} onRestart={restart} />;
}

function JungleMulti() {
  const { user } = useAuth();
  const { playSound } = useSound();
  const mp = useMultiplayer("jungle");
  const [step, setStep] = useState(0);
  const [hp, setHp] = useState(100);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const gs = mp.session?.game_state as Record<string, unknown> | null;
  const opp = mp.opponents[0];
  const oppScore = mp.session?.players.find((p) => p.id !== user?.id)?.score ?? 0;
  const bothDone = gs && user && opp ? gs[`fin_${user.id}`] === true && gs[`fin_${opp.id}`] === true : false;

  useEffect(() => {
    if (bothDone && mp.status === "playing") {
      const sorted = [...mp.session!.players].sort((a, b) => b.score - a.score);
      mp.endGame(sorted[0].score !== sorted[1]?.score ? sorted[0].id : undefined);
    }
  }, [bothDone, mp]);

  const choose = (choice: Choice) => {
    if (gameOver || mp.status !== "playing") return;
    const newHp = Math.min(100, hp + choice.hp);
    const nextScore = score + choice.score + Math.max(newHp, 0);
    setHp(newHp);
    setScore(nextScore);
    mp.updateMyScore(nextScore, false);
    if (newHp <= 0 || step + 1 >= SCENARIOS.length) {
      setGameOver(true);
      mp.updateMyScore(nextScore, true);
      playSound(newHp > 0 ? "success" : "navigate");
      return;
    }
    setStep((s) => s + 1);
    playSound(choice.hp >= 0 ? "success" : "navigate");
  };

  if (mp.status === "idle")
    return <MultiplayerLobby gameType="jungle" loading={mp.loading} onCreateRoom={mp.createRoom} onJoinRoom={mp.joinRoom} />;
  if (mp.status === "waiting")
    return <WaitingRoom session={mp.session!} isHost={mp.isHost} onStart={() => mp.startGame({ started: true })} onLeave={mp.leaveRoom} />;
  if (mp.status === "finished")
    return <FinishBanner winnerId={mp.session!.winner_id} myId={user?.id ?? ""} players={mp.session!.players} onRematch={mp.leaveRoom} />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between rounded-lg border p-3 text-sm">
        <div className="text-center"><p className="text-xs text-muted-foreground">You</p><p className="text-xl font-bold text-primary">{score}</p></div>
        <Badge variant="outline">{step + 1}/{SCENARIOS.length}</Badge>
        <div className="text-center"><p className="text-xs text-muted-foreground">{opp?.name ?? "Opponent"}</p><p className="text-xl font-bold">{oppScore}</p></div>
      </div>
      {gameOver ? (
        <Card><CardContent className="pt-6 text-center space-y-2"><p className="text-xl font-bold">Done! ✅</p><p className="text-muted-foreground">Score: {score} — Waiting for opponent…</p></CardContent></Card>
      ) : (
        <JungleBoard step={step} hp={hp} score={score} gameOver={false} onChoose={choose} />
      )}
    </div>
  );
}

export default function JungleSurvival() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<"solo" | "multi">("solo");

  return (
    <Layout>
      <section className="mx-auto max-w-2xl px-4 py-10">
        <div className="relative mb-6 overflow-hidden rounded-2xl">
          <img src={heroImg} alt="" role="presentation" className="h-40 w-full object-cover sm:h-48" width={800} height={512} loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 text-center">
            <h1 className="text-3xl font-bold">🌴 {t("jungle.title")}</h1>
          </div>
        </div>
        <div className="flex rounded-lg overflow-hidden border mb-6">
          <button onClick={() => setMode("solo")} className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "solo" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>🎮 Solo</button>
          <button onClick={() => setMode("multi")} className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "multi" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>👥 Online</button>
        </div>
        {mode === "solo" ? <JungleSolo /> : <JungleMulti />}
      </section>
    </Layout>
  );
}
