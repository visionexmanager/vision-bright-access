import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useState, useMemo, useEffect } from "react";
import heroImg from "@/assets/game-laptoptech.jpg";
import { useMultiplayer } from "@/hooks/useMultiplayer";
import { MultiplayerLobby } from "@/components/multiplayer/MultiplayerLobby";
import { WaitingRoom } from "@/components/multiplayer/WaitingRoom";
import { FinishBanner } from "@/components/multiplayer/OpponentPanel";
import { useAuth } from "@/contexts/AuthContext";
import { seededRng } from "@/systems/multiplayerSystem";

const ISSUES = [
  { symptom: "Screen flickering", fix: "Replace LCD cable", wrong: "Change RAM", points: 100 },
  { symptom: "Not charging", fix: "Replace charging port", wrong: "Update BIOS", points: 120 },
  { symptom: "Overheating & shutting down", fix: "Clean fan & replace thermal paste", wrong: "Replace hard drive", points: 150 },
  { symptom: "Keyboard keys not working", fix: "Replace keyboard ribbon cable", wrong: "Reinstall OS", points: 80 },
  { symptom: "Blue screen on startup", fix: "Run memory diagnostics & replace faulty RAM", wrong: "Replace screen", points: 130 },
];

function choicesFor(seed: number, current: number, issue: (typeof ISSUES)[number]) {
  const rng = seededRng(seed + current * 41);
  return rng() > 0.5 ? [issue.fix, issue.wrong] : [issue.wrong, issue.fix];
}

function LaptopBoard({
  current,
  score,
  feedback,
  choices,
  onAnswer,
}: {
  current: number;
  score: number;
  feedback: string | null;
  choices: string[];
  onAnswer: (correct: boolean) => void;
}) {
  const { t } = useLanguage();
  const issue = ISSUES[current];

  return (
    <>
      <div className="flex justify-center gap-4 mb-6">
        <Badge>⭐ {score}</Badge>
        <Badge variant="secondary">{current + 1}/{ISSUES.length}</Badge>
      </div>
      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="text-center">
            <p className="text-5xl mb-4">🖥️</p>
            <p className="text-lg font-bold">{t("laptoptech.symptom")}:</p>
            <p className="text-xl text-primary mt-2">{issue.symptom}</p>
          </div>
          {feedback ? (
            <p className="text-center text-lg font-bold">{feedback}</p>
          ) : (
            <div className="grid gap-3">
              {choices.map((choice) => (
                <Button key={choice} size="lg" variant="outline" className="h-auto py-4 text-base whitespace-normal" onClick={() => onAnswer(choice === issue.fix)}>
                  🔧 {choice}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function LaptopTechSolo() {
  const { t } = useLanguage();
  const { playSound } = useSound();
  const [current, setCurrent] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 999999));

  const done = current >= ISSUES.length;
  const issue = ISSUES[current];
  const choices = issue ? choicesFor(seed, current, issue) : [];

  const answer = (correct: boolean) => {
    if (!issue) return;
    if (correct) {
      setScore((s) => s + issue.points);
      playSound("success");
      setFeedback("✅ Correct!");
    } else {
      playSound("navigate");
      setFeedback(`❌ Wrong! Answer: ${issue.fix}`);
    }
    setTimeout(() => { setCurrent((c) => c + 1); setFeedback(null); }, 1200);
  };

  const restart = () => {
    setCurrent(0);
    setScore(0);
    setFeedback(null);
    setSeed(Math.floor(Math.random() * 999999));
    playSound("start");
  };

  if (done) {
    return (
      <Card><CardContent className="pt-6 text-center space-y-4">
        <p className="text-5xl">🔧</p>
        <p className="text-2xl font-bold">{t("laptoptech.finalScore")}: {score}</p>
        <Button size="lg" onClick={restart}>{t("laptoptech.restart")}</Button>
      </CardContent></Card>
    );
  }

  return <LaptopBoard current={current} score={score} feedback={feedback} choices={choices} onAnswer={answer} />;
}

function LaptopTechMulti() {
  const { user } = useAuth();
  const { playSound } = useSound();
  const mp = useMultiplayer("laptoptech");
  const [current, setCurrent] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const gs = mp.session?.game_state as Record<string, unknown> | null;
  const seed = (gs?.seed as number) ?? 1;
  const issue = ISSUES[current];
  const choices = useMemo(() => issue ? choicesFor(seed, current, issue) : [], [seed, current, issue]);
  const opp = mp.opponents[0];
  const oppScore = mp.session?.players.find((p) => p.id !== user?.id)?.score ?? 0;
  const bothDone = gs && user && opp ? gs[`fin_${user.id}`] === true && gs[`fin_${opp.id}`] === true : false;

  useEffect(() => {
    if (bothDone && mp.status === "playing") {
      const sorted = [...mp.session!.players].sort((a, b) => b.score - a.score);
      mp.endGame(sorted[0].score !== sorted[1]?.score ? sorted[0].id : undefined);
    }
  }, [bothDone, mp]);

  const answer = (correct: boolean) => {
    if (!issue || feedback || finished) return;
    const nextScore = correct ? score + issue.points : score;
    setScore(nextScore);
    mp.updateMyScore(nextScore, false);
    setFeedback(correct ? "✅ Correct!" : `❌ ${issue.fix}`);
    playSound(correct ? "success" : "navigate");
    setTimeout(() => {
      const next = current + 1;
      if (next >= ISSUES.length) {
        setFinished(true);
        mp.updateMyScore(nextScore, true);
      } else {
        setCurrent(next);
        setFeedback(null);
      }
    }, 1000);
  };

  if (mp.status === "idle")
    return <MultiplayerLobby gameType="laptoptech" loading={mp.loading} onCreateRoom={mp.createRoom} onJoinRoom={mp.joinRoom} />;
  if (mp.status === "waiting")
    return <WaitingRoom session={mp.session!} isHost={mp.isHost} onStart={() => mp.startGame({ seed: Math.floor(Math.random() * 999999) })} onLeave={mp.leaveRoom} />;
  if (mp.status === "finished")
    return <FinishBanner winnerId={mp.session!.winner_id} myId={user?.id ?? ""} players={mp.session!.players} onRematch={mp.leaveRoom} />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between rounded-lg border p-3 text-sm">
        <div className="text-center"><p className="text-xs text-muted-foreground">You</p><p className="text-xl font-bold text-primary">{score}</p></div>
        <Badge variant="outline">{Math.min(current + 1, ISSUES.length)}/{ISSUES.length}</Badge>
        <div className="text-center"><p className="text-xs text-muted-foreground">{opp?.name ?? "Opponent"}</p><p className="text-xl font-bold">{oppScore}</p></div>
      </div>
      {finished ? (
        <Card><CardContent className="pt-6 text-center space-y-2">
          <p className="text-xl font-bold">Done! ✅</p>
          <p className="text-muted-foreground">Score: {score} — Waiting for opponent…</p>
        </CardContent></Card>
      ) : (
        <LaptopBoard current={current} score={score} feedback={feedback} choices={choices} onAnswer={answer} />
      )}
    </div>
  );
}

export default function LaptopTechMaster() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<"solo" | "multi">("solo");

  return (
    <Layout>
      <section className="mx-auto max-w-2xl px-4 py-10">
        <div className="relative mb-6 overflow-hidden rounded-2xl">
          <img src={heroImg} alt="" role="presentation" className="h-40 w-full object-cover sm:h-48" width={800} height={512} loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 text-center">
            <h1 className="text-3xl font-bold">💻 {t("laptoptech.title")}</h1>
          </div>
        </div>
        <div className="flex rounded-lg overflow-hidden border mb-6">
          <button onClick={() => setMode("solo")} className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "solo" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>🎮 Solo</button>
          <button onClick={() => setMode("multi")} className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "multi" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>👥 Online</button>
        </div>
        {mode === "solo" ? <LaptopTechSolo /> : <LaptopTechMulti />}
      </section>
    </Layout>
  );
}
