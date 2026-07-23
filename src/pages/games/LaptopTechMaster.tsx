import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";
import { useGameSounds } from "@/hooks/useGameSounds";
import { useHighScore } from "@/hooks/useHighScore";
import { GameHeader } from "@/components/game/GameHeader";
import { HowToPlay } from "@/components/game/HowToPlay";
import { useState, useEffect, useMemo } from "react";
import heroImg from "@/assets/game-laptoptech.jpg";
import { useMultiplayer } from "@/hooks/useMultiplayer";
import { MultiplayerLobby } from "@/components/multiplayer/MultiplayerLobby";
import { WaitingRoom } from "@/components/multiplayer/WaitingRoom";
import { FinishBanner } from "@/components/multiplayer/OpponentPanel";
import { useAuth } from "@/contexts/AuthContext";
import { seededRng } from "@/systems/multiplayerSystem";
import { useGameEconomy } from "@/components/game/GameEconomyGate";

const TOTAL_ISSUES = 20;
const ISSUES_PER_GAME = 8;
const SECONDS_PER_ISSUE = 20;
const HINT_COST = 30;

function pickIssues(seed = Math.random()): number[] {
  const all = Array.from({ length: TOTAL_ISSUES }, (_, i) => i + 1);
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(seed * (i + 1)) % (i + 1);
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.slice(0, ISSUES_PER_GAME);
}

function buildChoices(rng: () => number, fix: string, wrong: string): [string[], number] {
  return rng() > 0.5 ? [[fix, wrong], 0] : [[wrong, fix], 1];
}

// ─── Solo Board ────────────────────────────────────────────────────────────────
function LaptopBoard() {
  const { t } = useLanguage();
  const { techClick, techRepair, techBoot, techError } = useGameSounds();
  const { highScore, updateHighScore } = useHighScore("laptoptech");
  const { settleGameResult } = useGameEconomy();

  const issueIds = useMemo(() => pickIssues(), []);
  const [current,   setCurrent]   = useState(0);
  const [score,     setScore]     = useState(0);
  const [feedback,  setFeedback]  = useState<string | null>(null);
  const [timeLeft,  setTimeLeft]  = useState(SECONDS_PER_ISSUE);
  const [hintUsed,  setHintUsed]  = useState(false);
  const [eliminated, setEliminated] = useState<number | null>(null);
  const [newRecord,  setNewRecord] = useState(false);

  const iId = issueIds[current];
  const fix   = t(`laptoptech.i${iId}.f`);
  const wrong = t(`laptoptech.i${iId}.w`);
  const seed  = iId * 0.137;
  const rng   = seededRng(seed);
  const [choices, correctIdx] = useMemo(() => buildChoices(rng, fix, wrong), [iId, fix, wrong]);

  useEffect(() => {
    if (feedback !== null || current >= ISSUES_PER_GAME) return;
    if (timeLeft <= 0) { setFeedback("⏱️ " + t("laptoptech.symptom")); techError(); advance(score, false); return; }
    const timer = setTimeout(() => setTimeLeft(v => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, feedback, current]);

  const advance = (s: number, correct: boolean) => {
    setTimeout(() => {
      const next = current + 1;
      if (next >= ISSUES_PER_GAME) {
        const isNew = updateHighScore(s);
        setNewRecord(isNew);
        void settleGameResult(s >= ISSUES_PER_GAME * 50 ? "win" : "loss", "Laptop Tech Master");
      }
      setCurrent(next);
      setFeedback(null);
      setHintUsed(false);
      setEliminated(null);
      setTimeLeft(SECONDS_PER_ISSUE);
    }, correct ? 800 : 1200);
  };

  const answer = (idx: number) => {
    if (feedback !== null) return;
    techClick();
    const correct = idx === correctIdx;
    const pts = correct ? 100 + timeLeft * 3 : 0;
    const ns = score + pts;
    setScore(ns);
    setFeedback(correct ? `✅ ${choices[correctIdx]}` : `❌ ${choices[correctIdx]}`);
    if (correct) techRepair();
    else techError();
    advance(ns, correct);
  };

  const useHint = () => {
    if (hintUsed || feedback !== null) return;
    const wrongIdx = correctIdx === 0 ? 1 : 0;
    setEliminated(wrongIdx);
    setHintUsed(true);
    setScore(s => Math.max(0, s - HINT_COST));
  };

  const done = current >= ISSUES_PER_GAME;

  if (done) {
    return (
      <Card><CardContent className="pt-6 text-center space-y-4">
        <p className="text-5xl">💻</p>
        {newRecord && <p className="text-primary font-bold animate-bounce">{t("games.newRecord")}</p>}
        <p className="text-2xl font-bold">{t("laptoptech.score")}: {score}</p>
        <p className="text-muted-foreground">{t("games.highScore")}: {highScore}</p>
        <Button size="lg" onClick={() => { setCurrent(0); setScore(0); setFeedback(null); setTimeLeft(SECONDS_PER_ISSUE); setNewRecord(false); }}>
          {t("laptoptech.restart")}
        </Button>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2 mb-2">
        <Badge>⭐ {score}</Badge>
        <Badge variant="outline">{current + 1}/{ISSUES_PER_GAME}</Badge>
        <Badge variant={timeLeft <= 5 ? "destructive" : "secondary"}>⏱️ {timeLeft}s</Badge>
      </div>
      <Progress value={(timeLeft / SECONDS_PER_ISSUE) * 100}
        className={timeLeft <= 5 ? "[&>div]:bg-destructive" : ""} />

      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="text-center">
            <p className="text-5xl mb-4">🖥️</p>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">{t("laptoptech.symptom")}:</p>
            <p className="text-xl text-primary mt-2 font-bold leading-relaxed">
              {t(`laptoptech.i${iId}.s`)}
            </p>
          </div>

          {feedback ? (
            <p className={`text-center text-lg font-bold rounded-lg p-3 ${
              feedback.startsWith("✅") ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-destructive"
            }`}>{feedback}</p>
          ) : (
            <div className="grid gap-3">
              {choices.map((choice, i) => (
                <Button
                  key={i}
                  size="lg"
                  variant={eliminated === i ? "ghost" : "outline"}
                  className={`h-auto py-4 text-base whitespace-normal ${eliminated === i ? "opacity-30 line-through pointer-events-none" : ""}`}
                  disabled={feedback !== null || eliminated === i}
                  onClick={() => answer(i)}
                >
                  🔧 {choice}
                </Button>
              ))}
            </div>
          )}

          {!feedback && !hintUsed && (
            <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground"
              onClick={useHint}>
              {t("laptoptech.hintBtn")}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Multiplayer ────────────────────────────────────────────────────────────────
function LaptopMulti() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { techClick, techRepair, techError } = useGameSounds();
  const mp = useMultiplayer("laptoptech");

  const issueIds = useMemo(() => pickIssues(0.77), []);
  const [current,  setCurrent]  = useState(0);
  const [myScore,  setMyScore]  = useState(0);
  const [answered, setAnswered] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);

  const gs      = mp.session?.game_state as Record<string, unknown> | null;
  const opp     = mp.opponents[0];
  const oppScore = mp.session?.players.find((p) => p.id !== user?.id)?.score ?? 0;
  const bothDone = gs && user && opp
    ? gs[`fin_${user.id}`] === true && gs[`fin_${opp.id}`] === true : false;

  useEffect(() => {
    if (bothDone && mp.status === "playing") {
      const sorted = [...mp.session!.players].sort((a, b) => b.score - a.score);
      mp.endGame(sorted[0].score !== sorted[1]?.score ? sorted[0].id : undefined);
    }
  }, [bothDone]);

  const advance = (s: number) => {
    const next = current + 1;
    if (next >= ISSUES_PER_GAME) { setFinished(true); mp.updateMyScore(s, true); }
    else { setCurrent(next); setAnswered(null); }
  };

  const answer = (idx: number, correctIdx: number) => {
    if (answered !== null || finished) return;
    setAnswered(idx);
    techClick();
    const correct = idx === correctIdx;
    const ns = myScore + (correct ? 100 : 0);
    setMyScore(ns);
    mp.updateMyScore(ns, false);
    if (correct) techRepair();
    else techError();
    setTimeout(() => advance(ns), 800);
  };

  if (mp.status === "idle")
    return <MultiplayerLobby gameType="laptoptech" loading={mp.loading} onCreateRoom={mp.createRoom} onJoinRoom={mp.joinRoom} />;
  if (mp.status === "waiting")
    return <WaitingRoom session={mp.session!} isHost={mp.isHost} onStart={() => mp.startGame({ started: true })} onLeave={mp.leaveRoom} />;
  if (mp.status === "finished")
    return <FinishBanner winnerId={mp.session!.winner_id} myId={user?.id ?? ""} players={mp.session!.players} onRematch={mp.leaveRoom} />;

  const iId = issueIds[current];
  const fix   = t(`laptoptech.i${iId}.f`);
  const wrong = t(`laptoptech.i${iId}.w`);
  const rng   = seededRng(iId * 0.137);
  const [choices, correctIdx] = buildChoices(rng, fix, wrong);

  return (
    <div className="space-y-4">
      <div className="flex justify-between rounded-lg border p-3 text-sm">
        <div className="text-center"><p className="text-xs text-muted-foreground">You</p><p className="text-xl font-bold text-primary">{myScore}</p></div>
        <Badge variant="outline">Case {current + 1}/{ISSUES_PER_GAME}</Badge>
        <div className="text-center"><p className="text-xs text-muted-foreground">{opp?.name}</p><p className="text-xl font-bold">{oppScore}</p></div>
      </div>
      {finished ? (
        <Card><CardContent className="pt-6 text-center"><p className="font-bold">Done! Waiting…</p></CardContent></Card>
      ) : (
        <Card><CardContent className="pt-6 space-y-5">
          <p className="text-5xl text-center">🖥️</p>
          <p className="text-xl text-primary font-bold text-center">{t(`laptoptech.i${iId}.s`)}</p>
          <div className="grid gap-3">
            {choices.map((c, i) => (
              <Button key={i} size="lg" variant="outline" className="h-auto py-4 whitespace-normal"
                disabled={answered !== null} onClick={() => answer(i, correctIdx)}>
                🔧 {c}
              </Button>
            ))}
          </div>
        </CardContent></Card>
      )}
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────────
export default function LaptopTechMaster() {
  const { t } = useLanguage();
  const { highScore } = useHighScore("laptoptech");
  const [mode, setMode] = useState<"solo" | "multi">("solo");

  return (
    <Layout>
      <section className="mx-auto max-w-2xl px-4 py-10">
        <div className="relative mb-6 overflow-hidden rounded-2xl">
          <img src={heroImg} alt="" role="presentation" className="h-40 w-full object-cover sm:h-48" width={800} height={512} loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute bottom-4 start-4 end-4 text-center">
            <h1 className="text-3xl font-bold">💻 {t("laptoptech.title")}</h1>
          </div>
        </div>
        <GameHeader
          title={t("laptoptech.title")}
          highScore={highScore}
          extra={
            <HowToPlay
              titleKey="laptoptech.title"
              steps={["laptoptech.howTo.1","laptoptech.howTo.2","laptoptech.howTo.3","laptoptech.howTo.4","laptoptech.howTo.5"]}
            />
          }
        />
        <div className="flex rounded-lg overflow-hidden border mb-6">
          <button onClick={() => setMode("solo")}  className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "solo"  ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>🎮 Solo</button>
          <button onClick={() => setMode("multi")} className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "multi" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>👥 Online</button>
        </div>
        {mode === "solo" ? <LaptopBoard /> : <LaptopMulti />}
      </section>
    </Layout>
  );
}
