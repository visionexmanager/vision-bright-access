import { useState, useEffect, useCallback, useRef } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { Trophy, RotateCcw, Play, Timer } from "lucide-react";

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

export default function QuizChallenge() {
  const { t } = useLanguage();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(3);
  const [gameState, setGameState] = useState<GameState>("start");

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
    setGameState("playing");
  };

  const rank = getRank(score);
  const progress = ((currentQuestion + 1) / questions.length) * 100;

  return (
    <Layout>
      <section className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center px-4 py-12">
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
              <Button size="lg" onClick={restart} className="text-lg font-bold">
                <RotateCcw className="me-2 h-5 w-5" /> حاول مرة أخرى
              </Button>
            </div>
          )}
        </Card>
      </section>
    </Layout>
  );
}
