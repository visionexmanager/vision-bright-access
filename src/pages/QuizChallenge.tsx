import { useState, useEffect, useCallback, useRef } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useEarnPoints } from "@/hooks/useEarnPoints";
import { usePoints } from "@/hooks/usePoints";
import { Trophy, RotateCcw, Play, Coins, LogIn } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useMultiplayer } from "@/hooks/useMultiplayer";
import { MultiplayerLobby } from "@/components/multiplayer/MultiplayerLobby";
import { WaitingRoom } from "@/components/multiplayer/WaitingRoom";
import { FinishBanner } from "@/components/multiplayer/OpponentPanel";

const questions = [
  { id: 1, q: "ما هو أسرع حيوان بري في العالم؟", options: ["الأسد", "الفهد", "الغزال"], correct: 1 },
  { id: 2, q: "ما هي عاصمة لبنان؟", options: ["صيدا", "طرابلس", "بيروت"], correct: 2 },
  { id: 3, q: "كم عدد كواكب المجموعة الشمسية؟", options: ["8 كواكب", "9 كواكب", "7 كواكب"], correct: 0 },
  { id: 4, q: "ما هو أكبر محيط في العالم؟", options: ["الأطلسي", "الهادي", "الهندي"], correct: 1 },
  { id: 5, q: "ما هو المعدن الذي يتميز بلونه الأصفر؟", options: ["النحاس", "الحديد", "الذهب"], correct: 2 },
  { id: 6, q: "من هو الملقب بـ 'عميد الأدب العربي'؟", options: ["طه حسين", "نجيب محفوظ", "المتنبي"], correct: 0 },
  { id: 7, q: "ما هي أكبر قارة في العالم؟", options: ["أفريقيا", "أوروبا", "آسيا"], correct: 2 },
  { id: 8, q: "ما هو الغاز الضروري للتنفس؟", options: ["النيتروجين", "الأكسجين", "الهيدروجين"], correct: 1 },
  { id: 9, q: "كم عدد أضلاع المثلث؟", options: ["3 أضلاع", "4 أضلاع", "5 أضلاع"], correct: 0 },
  { id: 10, q: "أين تقع الأهرامات؟", options: ["الأردن", "العراق", "مصر"], correct: 2 },
  { id: 11, q: "ما هو لون الزمرد؟", options: ["أحمر", "أزرق", "أخضر"], correct: 2 },
  { id: 12, q: "ما هو العضو المسؤول عن ضخ الدم؟", options: ["الكبد", "القلب", "الرئتين"], correct: 1 },
  { id: 13, q: "كم عدد ساعات اليوم؟", options: ["12 ساعة", "24 ساعة", "48 ساعة"], correct: 1 },
  { id: 14, q: "ما هو أطول نهر في العالم؟", options: ["الأمازون", "النيل", "المسيسبي"], correct: 1 },
  { id: 15, q: "ما هي العملة المستخدمة في لبنان؟", options: ["الدولار", "الليرة", "الدينار"], correct: 1 },
  { id: 16, q: "كم عدد ألوان قوس قزح؟", options: ["5 ألوان", "7 ألوان", "9 ألوان"], correct: 1 },
  { id: 17, q: "ما هي عاصمة سوريا؟", options: ["حلب", "دمشق", "حمص"], correct: 1 },
  { id: 18, q: "أي كوكب يلقب بالكوكب الأحمر؟", options: ["المريخ", "زحل", "المشتري"], correct: 0 },
  { id: 19, q: "ما هي أكبر ثدييات العالم؟", options: ["الفيل", "الحوت الأزرق", "الزرافة"], correct: 1 },
  { id: 20, q: "كم عدد لاعبي فريق كرة القدم؟", options: ["9 لاعبين", "11 لاعب", "12 لاعب"], correct: 1 },
];

type GameState = "start" | "playing" | "end";

function getRank(finalScore: number) {
  if (finalScore >= 180) return { title: "أسطورة Visionex", rank: "legendary" };
  if (finalScore >= 120) return { title: "خبير عبقري", rank: "expert" };
  if (finalScore >= 60) return { title: "بطل صاعد", rank: "rising" };
  return { title: "مبتدئ طموح", rank: "beginner" };
}

function getPointsReward(gameScore: number): number {
  if (gameScore >= 180) return 50;
  if (gameScore >= 120) return 30;
  if (gameScore >= 60) return 15;
  if (gameScore >= 10) return 5;
  return 0;
}

// ─── Multiplayer competitive quiz ────────────────────────────────────────────
function QuizMulti() {
  const { user } = useAuth();
  const mp = useMultiplayer("quiz");
  const [currentQ, setCurrentQ] = useState(0);
  const [myScore, setMyScore]   = useState(0);
  const [finished, setFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState(3);

  const gs      = mp.session?.game_state as Record<string, unknown> | null;
  const opp     = mp.opponents[0];
  const oppScore = mp.session?.players.find((p) => p.id !== user?.id)?.score ?? 0;
  const bothDone = gs && user && opp
    ? gs[`fin_${user.id}`] === true && gs[`fin_${opp.id}`] === true
    : false;

  // Timer per question
  useEffect(() => {
    if (finished || mp.status !== "playing") return;
    if (timeLeft <= 0) { advance(); return; }
    const t = setTimeout(() => setTimeLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, finished, mp.status]);

  // When both done → end game
  useEffect(() => {
    if (bothDone && mp.status === "playing") {
      const allPlayers = mp.session!.players;
      const sorted = [...allPlayers].sort((a, b) => b.score - a.score);
      const winnerId = sorted[0].score !== sorted[1]?.score ? sorted[0].id : undefined;
      mp.endGame(winnerId);
    }
  }, [bothDone, mp]);

  const advance = useCallback(() => {
    const next = currentQ + 1;
    if (next >= questions.length) {
      setFinished(true);
      mp.updateMyScore(myScore, true);
    } else {
      setCurrentQ(next);
      setTimeLeft(3);
    }
  }, [currentQ, myScore, mp]);

  const handleAnswer = (idx: number) => {
    const correct = idx === questions[currentQ].correct;
    const newScore = correct ? myScore + 10 : myScore;
    setMyScore(newScore);
    mp.updateMyScore(newScore, false);
    advance();
  };

  if (mp.status === "idle")
    return <MultiplayerLobby gameType="quiz" loading={mp.loading} onCreateRoom={mp.createRoom} onJoinRoom={mp.joinRoom} />;
  if (mp.status === "waiting")
    return <WaitingRoom session={mp.session!} isHost={mp.isHost} onStart={() => mp.startGame({ started: true })} onLeave={mp.leaveRoom} />;
  if (mp.status === "finished")
    return <FinishBanner winnerId={mp.session!.winner_id} myId={user?.id ?? ""} players={mp.session!.players} onRematch={mp.leaveRoom} />;

  const q = questions[currentQ];
  const progress = ((currentQ + 1) / questions.length) * 100;

  return (
    <Card className="w-full border-2 border-primary/30 p-6 space-y-4">
      {/* Live scores */}
      <div className="flex justify-between items-center text-sm">
        <div className="text-center">
          <p className="text-xs text-muted-foreground">You</p>
          <p className="text-2xl font-bold text-primary">{myScore}</p>
        </div>
        <Badge variant="outline">Q {currentQ + 1}/{questions.length}</Badge>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">{opp?.name ?? "Opponent"}</p>
          <p className="text-2xl font-bold">{oppScore}</p>
        </div>
      </div>
      <Progress value={progress} className="h-2" />
      {finished ? (
        <div className="text-center py-6 space-y-2">
          <p className="text-xl font-bold">Done! ✅ Waiting for opponent…</p>
          <p className="text-muted-foreground">Your score: {myScore}</p>
        </div>
      ) : (
        <div className="space-y-4" dir="rtl">
          <div className={`flex h-12 w-12 mx-auto items-center justify-center rounded-full border-4 text-xl font-black ${timeLeft <= 1 ? "border-destructive text-destructive animate-pulse" : "border-primary text-primary"}`}>{timeLeft}</div>
          <h2 className="text-xl font-bold text-center" aria-live="polite">{q.q}</h2>
          <div className="grid gap-3">
            {q.options.map((opt, i) => (
              <Button key={i} variant="outline" className="justify-start py-4 text-lg" onClick={() => handleAnswer(i)}>
                <Badge variant="secondary" className="me-3">{i + 1}</Badge>{opt}
              </Button>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

export default function QuizChallenge() {
  const [mode, setMode] = useState<"solo" | "multi">("solo");
  const { t } = useLanguage();
  const { user } = useAuth();
  const { earnPoints } = useEarnPoints();
  const { totalPoints } = usePoints();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(3);
  const [gameState, setGameState] = useState<GameState>("start");
  const [pointsAwarded, setPointsAwarded] = useState(false);

  const correctSoundRef = useRef<HTMLAudioElement | null>(null);
  const wrongSoundRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    correctSoundRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3");
    wrongSoundRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2004/2004-preview.mp3");
  }, []);

  const nextQuestion = useCallback(() => {
    if (currentQuestion + 1 < questions.length) {
      setCurrentQuestion((prev) => prev + 1);
      setTimeLeft(3);
    } else {
      setGameState("end");
    }
  }, [currentQuestion]);

  // Award points when game ends
  useEffect(() => {
    if (gameState === "end" && !pointsAwarded && user) {
      const reward = getPointsReward(score);
      if (reward > 0) {
        earnPoints(reward, `Quiz Challenge — Score: ${score}`).then((ok) => {
          if (ok) {
            toast.success(t("games.quiz.pointsEarned").replace("{pts}", String(reward)));
          }
        });
      }
      setPointsAwarded(true);
    }
  }, [gameState, pointsAwarded, score, user, earnPoints, t]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (gameState === "playing" && timeLeft > 0) {
      timer = setTimeout(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (timeLeft === 0 && gameState === "playing") {
      wrongSoundRef.current?.play().catch(() => {});
      nextQuestion();
    }
    return () => clearTimeout(timer);
  }, [timeLeft, gameState, nextQuestion]);

  const handleAnswer = (index: number) => {
    if (index === questions[currentQuestion].correct) {
      correctSoundRef.current?.play().catch(() => {});
      setScore((prev) => prev + 10);
    } else {
      wrongSoundRef.current?.play().catch(() => {});
    }
    nextQuestion();
  };

  const restart = () => {
    setScore(0);
    setCurrentQuestion(0);
    setTimeLeft(3);
    setPointsAwarded(false);
    setGameState("playing");
  };

  const rank = getRank(score);
  const reward = getPointsReward(score);
  const progress = ((currentQuestion + 1) / questions.length) * 100;

  return (
    <Layout>
      <section className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center px-4 py-12">
        <div className="w-full space-y-4">
        {/* Mode toggle */}
        <div className="flex rounded-lg overflow-hidden border">
          <button onClick={() => setMode("solo")}  className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "solo"  ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>🎮 Solo</button>
          <button onClick={() => setMode("multi")} className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "multi" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>👥 Online</button>
        </div>
        {mode === "multi" ? <QuizMulti /> : (
        <Card className="w-full border-2 border-primary/30 p-6 sm:p-8 text-center">
          {gameState === "start" && (
            <div className="space-y-6">
              <Trophy className="mx-auto h-16 w-16 text-primary" aria-hidden="true" />
              <h1 className="text-3xl font-black sm:text-4xl" dir="rtl">
                تحدي الـ {questions.length} سؤال
              </h1>
              <p className="text-lg text-muted-foreground" dir="rtl">
                أثبت سرعتك وثقافتك لترتقي في تصنيف Visionex!
              </p>

              {user && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Coins className="h-4 w-4 text-primary" />
                  <span>{t("games.quiz.yourPoints").replace("{pts}", String(totalPoints))}</span>
                </div>
              )}

              <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground" dir="rtl">
                <p className="font-semibold text-foreground mb-1">{t("games.quiz.rewards")}</p>
                <p>🥇 180+ → 50 {t("games.quiz.pts")}</p>
                <p>🥈 120+ → 30 {t("games.quiz.pts")}</p>
                <p>🥉 60+ → 15 {t("games.quiz.pts")}</p>
                <p>⭐ 10+ → 5 {t("games.quiz.pts")}</p>
              </div>

              {!user && (
                <p className="text-sm text-muted-foreground">
                  <Link to="/login" className="text-primary underline">{t("nav.login")}</Link>
                  {" "}{t("games.quiz.loginToEarn")}
                </p>
              )}

              <Button size="lg" className="text-lg font-bold" onClick={() => setGameState("playing")}>
                <Play className="me-2 h-5 w-5" /> {t("games.quiz.start")}
              </Button>
            </div>
          )}

          {gameState === "playing" && (
            <div className="space-y-6" dir="rtl">
              <div className="flex items-center justify-between">
                <div className="text-start">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">النقاط</p>
                  <p className="text-2xl font-bold text-primary">{score}</p>
                </div>
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-full border-4 text-2xl font-black ${
                    timeLeft <= 1
                      ? "border-destructive text-destructive animate-pulse"
                      : "border-primary text-primary"
                  }`}
                  role="timer"
                  aria-label={`${timeLeft} seconds remaining`}
                >
                  {timeLeft}
                </div>
                <div className="text-end">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">السؤال</p>
                  <p className="text-xl font-bold">
                    {currentQuestion + 1}/{questions.length}
                  </p>
                </div>
              </div>

              <Progress value={progress} className="h-2" aria-label="Quiz progress" />

              <h2 className="min-h-[80px] text-xl font-bold sm:text-2xl" aria-live="polite">
                {questions[currentQuestion].q}
              </h2>

              <div className="grid gap-3">
                {questions[currentQuestion].options.map((opt, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="justify-start py-4 text-lg hover:border-primary hover:bg-primary/10"
                    onClick={() => handleAnswer(index)}
                  >
                    <Badge variant="secondary" className="me-3">
                      {index + 1}
                    </Badge>
                    {opt}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {gameState === "end" && (
            <div className="space-y-6" dir="rtl">
              <h2 className="text-2xl font-bold">النتيجة النهائية</h2>
              <div className="text-6xl font-black text-primary">{score}</div>
              <p className="text-xl">تصنيفك الحالي:</p>
              <p className="text-3xl font-black text-primary">{rank.title}</p>

              {user && reward > 0 && (
                <div className="flex items-center justify-center gap-2 rounded-lg bg-primary/10 p-3 text-primary font-semibold">
                  <Coins className="h-5 w-5" />
                  <span>+{reward} {t("games.quiz.pts")} {t("games.quiz.earned")}</span>
                </div>
              )}
              {!user && reward > 0 && (
                <p className="text-sm text-muted-foreground">
                  <Link to="/signup" className="text-primary underline">{t("nav.signup")}</Link>
                  {" "}{t("games.quiz.signupToEarn").replace("{pts}", String(reward))}
                </p>
              )}

              <Button size="lg" onClick={restart} className="text-lg font-bold">
                <RotateCcw className="me-2 h-5 w-5" /> حاول مرة أخرى
              </Button>
            </div>
          )}
        </Card>
        )}
        </div>
      </section>
    </Layout>
  );
}
