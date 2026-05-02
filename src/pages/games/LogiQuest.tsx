import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useState, useEffect } from "react";
import heroImg from "@/assets/game-logiquest.jpg";
import { useMultiplayer } from "@/hooks/useMultiplayer";
import { MultiplayerLobby } from "@/components/multiplayer/MultiplayerLobby";
import { WaitingRoom } from "@/components/multiplayer/WaitingRoom";
import { FinishBanner } from "@/components/multiplayer/OpponentPanel";
import { useAuth } from "@/contexts/AuthContext";

const PUZZLES = [
  { q: "If all cats are animals, and some animals are pets, which is true?", choices: ["All cats are pets","Some cats may be pets","No cats are pets","All pets are cats"], answer: 1 },
  { q: "What comes next: 2, 6, 18, 54, ?", choices: ["108","162","72","216"], answer: 1 },
  { q: "Complete: 🔺🔵🔺🔵🔺?", choices: ["🔺","🔵","⬛","🟢"], answer: 1 },
  { q: "A is taller than B, B is taller than C. Who is shortest?", choices: ["A","B","C","Cannot tell"], answer: 2 },
  { q: "If MOUSE = 13+15+21+19+5 = 73, what is CAT?", choices: ["24","22","26","28"], answer: 0 },
];

// ─── Solo ────────────────────────────────────────────────────────────────────
function LogiQuestSolo() {
  const { t } = useLanguage();
  const { playSound } = useSound();
  const [current,  setCurrent]  = useState(0);
  const [score,    setScore]    = useState(0);
  const [answered, setAnswered] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(15);

  useEffect(() => {
    if (current >= PUZZLES.length || answered !== null) return;
    if (timeLeft <= 0) { setAnswered(-1); playSound("navigate"); return; }
    const t = setTimeout(() => setTimeLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, current, answered, playSound]);

  const answer = (idx: number) => {
    if (answered !== null) return;
    setAnswered(idx);
    if (idx === PUZZLES[current].answer) { setScore((s) => s + 100 + timeLeft * 5); playSound("success"); }
    else playSound("navigate");
  };

  const next    = () => { setCurrent((c) => c + 1); setAnswered(null); setTimeLeft(15); };
  const restart = () => { setCurrent(0); setScore(0); setAnswered(null); setTimeLeft(15); playSound("start"); };
  const puzzle  = PUZZLES[current];
  const done    = current >= PUZZLES.length;

  return (
    <div className="space-y-4">
      {done ? (
        <Card><CardContent className="pt-6 text-center space-y-4">
          <p className="text-5xl">🧠</p>
          <p className="text-2xl font-bold">{t("logiquest.finalScore")}: {score}</p>
          <Button size="lg" onClick={restart}>{t("logiquest.restart")}</Button>
        </CardContent></Card>
      ) : (
        <Card><CardContent className="pt-6 space-y-6">
          <Progress value={(timeLeft / 15) * 100} />
          <div className="flex justify-between">
            <Badge variant={timeLeft < 5 ? "destructive" : "secondary"}>⏱️ {timeLeft}s</Badge>
            <Badge>⭐ {score}</Badge>
            <Badge variant="outline">{current + 1}/{PUZZLES.length}</Badge>
          </div>
          <p className="text-lg font-medium text-center">{puzzle.q}</p>
          <div className="grid gap-3">
            {puzzle.choices.map((c, i) => (
              <Button key={i} size="lg" className="text-base h-auto py-3 whitespace-normal"
                variant={answered === null ? "outline" : i === puzzle.answer ? "default" : answered === i ? "destructive" : "outline"}
                disabled={answered !== null} onClick={() => answer(i)}>{c}</Button>
            ))}
          </div>
          {answered !== null && <Button className="w-full" onClick={next}>{t("logiquest.next")}</Button>}
        </CardContent></Card>
      )}
    </div>
  );
}

// ─── Multiplayer (race — same puzzles, compare scores) ───────────────────────
function LogiQuestMulti() {
  const { user } = useAuth();
  const { playSound } = useSound();
  const mp = useMultiplayer("logiquest");

  const [current,  setCurrent]  = useState(0);
  const [myScore,  setMyScore]  = useState(0);
  const [answered, setAnswered] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(15);
  const [finished, setFinished] = useState(false);

  const gs      = mp.session?.game_state as Record<string, unknown> | null;
  const opp     = mp.opponents[0];
  const oppScore = mp.session?.players.find((p) => p.id !== user?.id)?.score ?? 0;
  const bothDone = gs && user && opp
    ? gs[`fin_${user.id}`] === true && gs[`fin_${opp.id}`] === true
    : false;

  // Timer
  useEffect(() => {
    if (finished || mp.status !== "playing" || answered !== null) return;
    if (timeLeft <= 0) { autoNext(); return; }
    const t = setTimeout(() => setTimeLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, finished, mp.status, answered]);

  // Both done → end game
  useEffect(() => {
    if (bothDone && mp.status === "playing") {
      const allPlayers = mp.session!.players;
      const sorted = [...allPlayers].sort((a, b) => b.score - a.score);
      mp.endGame(sorted[0].score !== sorted[1]?.score ? sorted[0].id : undefined);
    }
  }, [bothDone, mp]);

  const autoNext = () => {
    playSound("navigate");
    advance(myScore);
  };

  const advance = (score: number) => {
    const next = current + 1;
    if (next >= PUZZLES.length) {
      setFinished(true);
      mp.updateMyScore(score, true);
    } else {
      setCurrent(next); setAnswered(null); setTimeLeft(15);
    }
  };

  const answer = (idx: number) => {
    if (answered !== null || finished) return;
    setAnswered(idx);
    const correct = idx === PUZZLES[current].answer;
    const bonus   = correct ? 100 + timeLeft * 5 : 0;
    const newScore = myScore + bonus;
    setMyScore(newScore);
    mp.updateMyScore(newScore, false);
    if (correct) playSound("success"); else playSound("navigate");
    setTimeout(() => advance(newScore), 800);
  };

  if (mp.status === "idle")
    return <MultiplayerLobby gameType="logiquest" loading={mp.loading} onCreateRoom={mp.createRoom} onJoinRoom={mp.joinRoom} />;
  if (mp.status === "waiting")
    return <WaitingRoom session={mp.session!} isHost={mp.isHost} onStart={() => mp.startGame({ started: true })} onLeave={mp.leaveRoom} />;
  if (mp.status === "finished")
    return <FinishBanner winnerId={mp.session!.winner_id} myId={user?.id ?? ""} players={mp.session!.players} onRematch={mp.leaveRoom} />;

  const puzzle = PUZZLES[current];

  return (
    <div className="space-y-4">
      <div className="flex justify-between rounded-lg border p-3 text-sm">
        <div className="text-center"><p className="text-xs text-muted-foreground">You</p><p className="text-xl font-bold text-primary">{myScore}</p></div>
        <div className="text-center self-center"><Badge variant="outline">Q {current + 1}/{PUZZLES.length}</Badge></div>
        <div className="text-center"><p className="text-xs text-muted-foreground">{opp?.name ?? "Opponent"}</p><p className="text-xl font-bold">{oppScore}</p></div>
      </div>
      {finished ? (
        <Card><CardContent className="pt-6 text-center space-y-2">
          <p className="text-xl font-bold">Done! ✅</p>
          <p className="text-muted-foreground">Score: {myScore} — Waiting for opponent…</p>
        </CardContent></Card>
      ) : (
        <Card><CardContent className="pt-6 space-y-6">
          <Progress value={(timeLeft / 15) * 100} />
          <Badge variant={timeLeft < 5 ? "destructive" : "secondary"}>⏱️ {timeLeft}s</Badge>
          <p className="text-lg font-medium text-center">{puzzle.q}</p>
          <div className="grid gap-3">
            {puzzle.choices.map((c, i) => (
              <Button key={i} size="lg" className="text-base h-auto py-3 whitespace-normal"
                variant={answered === null ? "outline" : i === puzzle.answer ? "default" : answered === i ? "destructive" : "outline"}
                disabled={answered !== null} onClick={() => answer(i)}>{c}</Button>
            ))}
          </div>
        </CardContent></Card>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LogiQuest() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<"solo" | "multi">("solo");

  return (
    <Layout>
      <section className="mx-auto max-w-2xl px-4 py-10">
        <div className="relative mb-6 overflow-hidden rounded-2xl">
          <img src={heroImg} alt="" role="presentation" className="h-40 w-full object-cover sm:h-48" width={800} height={512} loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 text-center">
            <h1 className="text-3xl font-bold">🧩 {t("logiquest.title")}</h1>
          </div>
        </div>
        <div className="flex rounded-lg overflow-hidden border mb-6">
          <button onClick={() => setMode("solo")}  className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "solo"  ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>🎮 Solo</button>
          <button onClick={() => setMode("multi")} className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "multi" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>👥 Online</button>
        </div>
        {mode === "solo" ? <LogiQuestSolo /> : <LogiQuestMulti />}
      </section>
    </Layout>
  );
}
