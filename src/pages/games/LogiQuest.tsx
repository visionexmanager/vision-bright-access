import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useGameSounds } from "@/hooks/useGameSounds";
import { useHighScore } from "@/hooks/useHighScore";
import { GameHeader } from "@/components/game/GameHeader";
import { HowToPlay } from "@/components/game/HowToPlay";
import { useState, useEffect, useMemo } from "react";
import heroImg from "@/assets/game-logiquest.jpg";
import { useMultiplayer } from "@/hooks/useMultiplayer";
import { MultiplayerLobby } from "@/components/multiplayer/MultiplayerLobby";
import { WaitingRoom } from "@/components/multiplayer/WaitingRoom";
import { FinishBanner } from "@/components/multiplayer/OpponentPanel";
import { useAuth } from "@/contexts/AuthContext";
import { useGameEconomy } from "@/components/game/GameEconomyGate";

const TOTAL_QUESTIONS = 30;
const QUESTIONS_PER_GAME = 10;

type Difficulty = "easy" | "medium" | "hard";
const TIME_BY_DIFF: Record<Difficulty, number> = { easy: 20, medium: 15, hard: 10 };

// Build puzzle index array [1..30], shuffle, take first 10
function pickQuestions(seed = Math.random()): number[] {
  const all = Array.from({ length: TOTAL_QUESTIONS }, (_, i) => i + 1);
  // Fisher-Yates with seeded-ish random based on seed
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor((seed * (i + 1) * 9301 + 49297) % 233280 / 233280 * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.slice(0, QUESTIONS_PER_GAME);
}

// ─── Solo ──────────────────────────────────────────────────────────────────────
function LogiQuestSolo() {
  const { t } = useLanguage();
  const { logiCorrect, logiWrong, logiTimerWarn } = useGameSounds();
  const { highScore, updateHighScore } = useHighScore("logiquest");
  const { settleGameResult } = useGameEconomy();

  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [questionIds, setQuestionIds] = useState<number[]>([]);
  const [current,  setCurrent]  = useState(0);
  const [score,    setScore]    = useState(0);
  const [answered, setAnswered] = useState<number | null>(null);
  const [showExplain, setShowExplain] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15);
  const [streak, setStreak] = useState(0);
  const [newRecord, setNewRecord] = useState(false);

  const maxTime = difficulty ? TIME_BY_DIFF[difficulty] : 15;

  function startGame(diff: Difficulty) {
    setDifficulty(diff);
    setQuestionIds(pickQuestions());
    setCurrent(0); setScore(0);
    setAnswered(null); setShowExplain(false);
    setStreak(0); setNewRecord(false);
    setTimeLeft(TIME_BY_DIFF[diff]);
  }

  useEffect(() => {
    if (!difficulty || answered !== null || current >= QUESTIONS_PER_GAME) return;
    if (timeLeft <= 0) { setAnswered(-1); logiWrong(); setStreak(0); return; }
    if (timeLeft === 3) logiTimerWarn();
    const timer = setTimeout(() => setTimeLeft(v => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, difficulty, answered, current]);

  const answer = (idx: number) => {
    if (answered !== null || !difficulty) return;
    const qId = questionIds[current];
    const correct = parseInt(t(`logiquest.q${qId}.correct`)) === idx;
    setAnswered(idx);
    if (correct) {
      const bonus = 100 + timeLeft * 5 + streak * 20;
      setScore(s => s + bonus);
      setStreak(s => s + 1);
      logiCorrect();
    } else {
      logiWrong();
      setStreak(0);
    }
  };

  const next = () => {
    const nextIdx = current + 1;
    if (nextIdx >= QUESTIONS_PER_GAME) {
      const isNew = updateHighScore(score);
      setNewRecord(isNew);
      void settleGameResult(score > 0 ? "win" : "loss", "LogiQuest");
    }
    setCurrent(nextIdx);
    setAnswered(null);
    setShowExplain(false);
    setTimeLeft(TIME_BY_DIFF[difficulty!]);
  };

  const done = current >= QUESTIONS_PER_GAME;

  if (!difficulty) {
    return (
      <Card>
        <CardContent className="pt-6 space-y-5 text-center">
          <p className="text-5xl">🧩</p>
          <p className="text-xl font-bold">{t("games.difficulty.select")}</p>
          <div className="grid gap-3">
            {(["easy", "medium", "hard"] as Difficulty[]).map(d => (
              <Button key={d} size="lg" variant={d === "medium" ? "default" : "outline"}
                onClick={() => startGame(d)}>
                {d === "easy" ? "😊" : d === "medium" ? "🧠" : "🔥"} {t(`games.difficulty.${d}`)} ({TIME_BY_DIFF[d]}s)
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (done) {
    return (
      <Card><CardContent className="pt-6 text-center space-y-4">
        <p className="text-5xl">🧠</p>
        {newRecord && <p className="text-primary font-bold">{t("games.newRecord")}</p>}
        <p className="text-2xl font-bold">{t("logiquest.finalScore")}: {score}</p>
        <p className="text-muted-foreground">{t("games.highScore")}: {highScore}</p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Button size="lg" onClick={() => startGame(difficulty)}>{t("logiquest.restart")}</Button>
          <Button size="lg" variant="outline" onClick={() => setDifficulty(null)}>{t("games.difficulty.select")}</Button>
        </div>
      </CardContent></Card>
    );
  }

  const qId = questionIds[current];
  const correctIdx = parseInt(t(`logiquest.q${qId}.correct`));

  return (
    <div className="space-y-4">
      <Card><CardContent className="pt-6 space-y-4">
        <Progress value={(timeLeft / maxTime) * 100}
          className={timeLeft <= 3 ? "[&>div]:bg-destructive" : ""} />
        <div className="flex justify-between items-center flex-wrap gap-2">
          <Badge variant={timeLeft <= 3 ? "destructive" : "secondary"}>⏱️ {timeLeft}s</Badge>
          <Badge>⭐ {score}</Badge>
          {streak >= 2 && <Badge className="bg-orange-500">{t("logiquest.streak").replace("{n}", String(streak))}</Badge>}
          <Badge variant="outline">{current + 1}/{QUESTIONS_PER_GAME}</Badge>
        </div>
        <p className="text-lg font-semibold text-center leading-relaxed">
          {t(`logiquest.q${qId}`)}
        </p>
        <div className="grid gap-3">
          {[0, 1, 2, 3].map(i => {
            const text = t(`logiquest.q${qId}.${i}`);
            if (!text || text === `logiquest.q${qId}.${i}`) return null;
            let variant: "default" | "outline" | "destructive" = "outline";
            if (answered !== null) {
              if (i === correctIdx) variant = "default";
              else if (i === answered) variant = "destructive";
            }
            return (
              <Button key={i} size="lg" className="text-base h-auto py-3 whitespace-normal"
                variant={variant}
                disabled={answered !== null}
                onClick={() => answer(i)}>
                {text}
              </Button>
            );
          })}
        </div>
        {answered !== null && (
          <div className="space-y-2">
            {showExplain ? (
              <p className="text-sm text-muted-foreground bg-muted rounded-lg p-3 text-center">
                💡 {t(`logiquest.q${qId}.explain`)}
              </p>
            ) : (
              <Button variant="ghost" size="sm" className="w-full text-xs"
                onClick={() => setShowExplain(true)}>
                {t("logiquest.explain")}
              </Button>
            )}
            <Button className="w-full" onClick={next}>{t("logiquest.next")}</Button>
          </div>
        )}
      </CardContent></Card>
    </div>
  );
}

// ─── Multiplayer ────────────────────────────────────────────────────────────────
function LogiQuestMulti() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { logiCorrect, logiWrong, logiTimerWarn } = useGameSounds();
  const mp = useMultiplayer("logiquest");

  // Use fixed question ids for multiplayer (same seed for both players)
  const questionIds = useMemo(() => pickQuestions(0.42), []);
  const [current,  setCurrent]  = useState(0);
  const [myScore,  setMyScore]  = useState(0);
  const [answered, setAnswered] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(15);
  const [finished, setFinished] = useState(false);

  const gs      = mp.session?.game_state as Record<string, unknown> | null;
  const opp     = mp.opponents[0];
  const oppScore = mp.session?.players.find((p) => p.id !== user?.id)?.score ?? 0;
  const bothDone = gs && user && opp
    ? gs[`fin_${user.id}`] === true && gs[`fin_${opp.id}`] === true : false;

  useEffect(() => {
    if (finished || mp.status !== "playing" || answered !== null) return;
    if (timeLeft <= 0) { logiWrong(); advance(myScore); return; }
    if (timeLeft === 5) logiTimerWarn();
    const timer = setTimeout(() => setTimeLeft(v => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, finished, mp.status, answered]);

  useEffect(() => {
    if (bothDone && mp.status === "playing") {
      const sorted = [...mp.session!.players].sort((a, b) => b.score - a.score);
      mp.endGame(sorted[0].score !== sorted[1]?.score ? sorted[0].id : undefined);
    }
  }, [bothDone]);

  const advance = (s: number) => {
    const next = current + 1;
    if (next >= QUESTIONS_PER_GAME) { setFinished(true); mp.updateMyScore(s, true); }
    else { setCurrent(next); setAnswered(null); setTimeLeft(15); }
  };

  const answer = (idx: number) => {
    if (answered !== null || finished) return;
    setAnswered(idx);
    const qId = questionIds[current];
    const correct = parseInt(t(`logiquest.q${qId}.correct`)) === idx;
    const bonus = correct ? 100 + timeLeft * 5 : 0;
    const ns = myScore + bonus;
    setMyScore(ns);
    mp.updateMyScore(ns, false);
    if (correct) logiCorrect(); else logiWrong();
    setTimeout(() => advance(ns), 800);
  };

  if (mp.status === "idle")
    return <MultiplayerLobby gameType="logiquest" loading={mp.loading} onCreateRoom={mp.createRoom} onJoinRoom={mp.joinRoom} />;
  if (mp.status === "waiting")
    return <WaitingRoom session={mp.session!} isHost={mp.isHost} onStart={() => mp.startGame({ started: true })} onLeave={mp.leaveRoom} />;
  if (mp.status === "finished")
    return <FinishBanner winnerId={mp.session!.winner_id} myId={user?.id ?? ""} players={mp.session!.players} onRematch={mp.leaveRoom} />;

  const qId = questionIds[current];
  const correctIdx = parseInt(t(`logiquest.q${qId}.correct`));

  return (
    <div className="space-y-4">
      <div className="flex justify-between rounded-lg border p-3 text-sm">
        <div className="text-center"><p className="text-xs text-muted-foreground">You</p><p className="text-xl font-bold text-primary">{myScore}</p></div>
        <div className="text-center self-center"><Badge variant="outline">Q {current + 1}/{QUESTIONS_PER_GAME}</Badge></div>
        <div className="text-center"><p className="text-xs text-muted-foreground">{opp?.name ?? "Opponent"}</p><p className="text-xl font-bold">{oppScore}</p></div>
      </div>
      {finished ? (
        <Card><CardContent className="pt-6 text-center space-y-2">
          <p className="text-xl font-bold">Done! ✅</p>
          <p className="text-muted-foreground">Score: {myScore} — Waiting…</p>
        </CardContent></Card>
      ) : (
        <Card><CardContent className="pt-6 space-y-6">
          <Progress value={(timeLeft / 15) * 100} />
          <Badge variant={timeLeft < 5 ? "destructive" : "secondary"}>⏱️ {timeLeft}s</Badge>
          <p className="text-lg font-medium text-center">{t(`logiquest.q${qId}`)}</p>
          <div className="grid gap-3">
            {[0, 1, 2, 3].map(i => {
              const text = t(`logiquest.q${qId}.${i}`);
              if (!text || text === `logiquest.q${qId}.${i}`) return null;
              let variant: "default" | "outline" | "destructive" = "outline";
              if (answered !== null) {
                if (i === correctIdx) variant = "default";
                else if (i === answered) variant = "destructive";
              }
              return (
                <Button key={i} size="lg" className="text-base h-auto py-3 whitespace-normal"
                  variant={variant}
                  disabled={answered !== null}
                  onClick={() => answer(i)}>{text}</Button>
              );
            })}
          </div>
        </CardContent></Card>
      )}
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────────
export default function LogiQuest() {
  const { t } = useLanguage();
  const { highScore } = useHighScore("logiquest");
  const [mode, setMode] = useState<"solo" | "multi">("solo");

  return (
    <Layout>
      <section className="mx-auto max-w-2xl px-4 py-10">
        <div className="relative mb-6 overflow-hidden rounded-2xl">
          <img src={heroImg} alt="" role="presentation" className="h-40 w-full object-cover sm:h-48" width={800} height={512} loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute bottom-4 start-4 end-4 text-center">
            <h1 className="text-3xl font-bold">🧩 {t("logiquest.title")}</h1>
          </div>
        </div>
        <GameHeader
          title={t("logiquest.title")}
          highScore={highScore}
          extra={
            <HowToPlay
              titleKey="logiquest.title"
              steps={["logiquest.howTo.1","logiquest.howTo.2","logiquest.howTo.3","logiquest.howTo.4","logiquest.howTo.5"]}
            />
          }
        />
        <div className="flex rounded-lg overflow-hidden border mb-6">
          <button onClick={() => setMode("solo")}  className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "solo"  ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>🎮 Solo</button>
          <button onClick={() => setMode("multi")} className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "multi" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>👥 Online</button>
        </div>
        {mode === "solo" ? <LogiQuestSolo /> : <LogiQuestMulti />}
      </section>
    </Layout>
  );
}
