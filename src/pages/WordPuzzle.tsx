import { useState, useEffect, useCallback, useRef } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useEarnPoints } from "@/hooks/useEarnPoints";
import { usePoints } from "@/hooks/usePoints";
import { Trophy, RotateCcw, Play, Coins, Check, X } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

interface WordEntry {
  word: string;
  hint: string;
}

const WORDS_EN: WordEntry[] = [
  { word: "KEYBOARD", hint: "You type with this" },
  { word: "CONTRAST", hint: "Light vs dark difference" },
  { word: "BRAILLE", hint: "Tactile reading system" },
  { word: "WEBSITE", hint: "Pages on the internet" },
  { word: "DESIGN", hint: "Creating visual layouts" },
  { word: "SCREEN", hint: "Display you look at" },
  { word: "SPEECH", hint: "Talking output from a device" },
  { word: "ACCESS", hint: "Ability to reach or use" },
  { word: "VISION", hint: "Sense of sight" },
  { word: "CURSOR", hint: "Pointer on screen" },
];

const WORDS_AR: WordEntry[] = [
  { word: "لوحة", hint: "تكتب عليها" },
  { word: "تباين", hint: "الفرق بين الفاتح والداكن" },
  { word: "برايل", hint: "نظام قراءة باللمس" },
  { word: "موقع", hint: "صفحات على الإنترنت" },
  { word: "تصميم", hint: "إنشاء تخطيطات بصرية" },
  { word: "شاشة", hint: "العرض الذي تنظر إليه" },
  { word: "صوت", hint: "مخرج ناطق من الجهاز" },
  { word: "وصول", hint: "القدرة على الوصول أو الاستخدام" },
  { word: "رؤية", hint: "حاسة البصر" },
  { word: "مؤشر", hint: "السهم على الشاشة" },
];

const WORDS_ES: WordEntry[] = [
  { word: "TECLADO", hint: "Escribes con esto" },
  { word: "CONTRAS", hint: "Diferencia claro vs oscuro" },
  { word: "BRAILLE", hint: "Sistema de lectura táctil" },
  { word: "PAGINA", hint: "Páginas en internet" },
  { word: "DISEÑO", hint: "Crear diseños visuales" },
  { word: "PANTAL", hint: "Display que miras" },
  { word: "HABLAR", hint: "Salida de voz del dispositivo" },
  { word: "ACCESO", hint: "Capacidad de alcanzar o usar" },
  { word: "VISION", hint: "Sentido de la vista" },
  { word: "CURSOR", hint: "Puntero en pantalla" },
];

function scramble(word: string): string {
  const arr = word.split("");
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const result = arr.join("");
  return result === word ? scramble(word) : result;
}

function getPointsReward(score: number, total: number): number {
  const pct = score / total;
  if (pct >= 0.9) return 40;
  if (pct >= 0.7) return 25;
  if (pct >= 0.5) return 15;
  if (pct >= 0.3) return 5;
  return 0;
}

type GameState = "start" | "playing" | "end";
const TOTAL_ROUNDS = 8;

export default function WordPuzzle() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const { earnPoints } = useEarnPoints();
  const { totalPoints } = usePoints();

  const wordList = lang === "ar" ? WORDS_AR : lang === "es" ? WORDS_ES : WORDS_EN;

  const [gameWords, setGameWords] = useState<WordEntry[]>([]);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [guess, setGuess] = useState("");
  const [scrambled, setScrambled] = useState("");
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [gameState, setGameState] = useState<GameState>("start");
  const [pointsAwarded, setPointsAwarded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const liveRef = useRef<HTMLDivElement>(null);

  const announce = useCallback((msg: string) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  }, []);

  const pickWords = useCallback(() => {
    const shuffled = [...wordList].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, TOTAL_ROUNDS);
  }, [wordList]);

  const startGame = () => {
    const words = pickWords();
    setGameWords(words);
    setRound(0);
    setScore(0);
    setGuess("");
    setFeedback(null);
    setPointsAwarded(false);
    setScrambled(scramble(words[0].word));
    setGameState("playing");
  };

  useEffect(() => {
    if (gameState === "playing" && gameWords[round]) {
      setScrambled(scramble(gameWords[round].word));
      setGuess("");
      setFeedback(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [round, gameState, gameWords]);

  // Award points
  useEffect(() => {
    if (gameState === "end" && !pointsAwarded && user) {
      const reward = getPointsReward(score, TOTAL_ROUNDS);
      if (reward > 0) {
        earnPoints(reward, `Word Puzzle — Score: ${score}/${TOTAL_ROUNDS}`).then((ok) => {
          if (ok) {
            toast.success(t("games.word.pointsEarned").replace("{pts}", String(reward)));
          }
        });
      }
      setPointsAwarded(true);
    }
  }, [gameState, pointsAwarded, score, user, earnPoints, t]);

  const submitGuess = () => {
    if (!guess.trim()) return;
    const correct = guess.trim().toUpperCase() === gameWords[round].word.toUpperCase() ||
                    guess.trim() === gameWords[round].word;
    if (correct) {
      setScore((p) => p + 1);
      setFeedback("correct");
      announce(t("games.word.correct"));
    } else {
      setFeedback("wrong");
      announce(`${t("games.word.wrong")} ${gameWords[round].word}`);
    }

    setTimeout(() => {
      if (round + 1 < TOTAL_ROUNDS) {
        setRound((p) => p + 1);
      } else {
        setGameState("end");
      }
    }, 1200);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitGuess();
    }
  };

  const progress = gameState === "playing" ? ((round + 1) / TOTAL_ROUNDS) * 100 : 0;
  const reward = getPointsReward(score, TOTAL_ROUNDS);

  return (
    <Layout>
      <div ref={liveRef} aria-live="assertive" aria-atomic="true" className="sr-only" />

      <section className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center px-4 py-12">
        <Card className="w-full border-2 border-primary/30 p-6 sm:p-8 text-center">
          {gameState === "start" && (
            <div className="space-y-6">
              <Trophy className="mx-auto h-16 w-16 text-primary" aria-hidden="true" />
              <h1 className="text-3xl font-black sm:text-4xl">{t("games.word.title")}</h1>
              <p className="text-lg text-muted-foreground">{t("games.word.desc")}</p>

              {user && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Coins className="h-4 w-4 text-primary" />
                  <span>{t("games.quiz.yourPoints").replace("{pts}", String(totalPoints))}</span>
                </div>
              )}

              <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
                <p className="font-semibold text-foreground mb-1">{t("games.quiz.rewards")}</p>
                <p>🥇 90%+ → 40 {t("games.quiz.pts")}</p>
                <p>🥈 70%+ → 25 {t("games.quiz.pts")}</p>
                <p>🥉 50%+ → 15 {t("games.quiz.pts")}</p>
                <p>⭐ 30%+ → 5 {t("games.quiz.pts")}</p>
              </div>

              {!user && (
                <p className="text-sm text-muted-foreground">
                  <Link to="/login" className="text-primary underline">{t("nav.login")}</Link>
                  {" "}{t("games.quiz.loginToEarn")}
                </p>
              )}

              <Button size="lg" className="text-lg font-bold" onClick={startGame}>
                <Play className="me-2 h-5 w-5" /> {t("games.quiz.start")}
              </Button>
            </div>
          )}

          {gameState === "playing" && gameWords[round] && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    {t("games.word.score")}
                  </p>
                  <p className="text-2xl font-bold text-primary">{score}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    {t("games.word.round")}
                  </p>
                  <p className="text-xl font-bold">{round + 1}/{TOTAL_ROUNDS}</p>
                </div>
              </div>

              <Progress value={progress} className="h-2" aria-label="Game progress" />

              <div>
                <p className="text-sm text-muted-foreground mb-2">{t("games.word.hintLabel")}</p>
                <p className="text-lg font-semibold text-foreground" aria-live="polite">
                  {gameWords[round].hint}
                </p>
              </div>

              <div
                className="text-4xl sm:text-5xl font-black tracking-[0.3em] text-primary py-4"
                aria-label={`${t("games.word.scrambledLetters")}: ${scrambled.split("").join(", ")}`}
              >
                {scrambled}
              </div>

              <div className="flex gap-3">
                <label htmlFor="word-guess" className="sr-only">
                  {t("games.word.inputLabel")}
                </label>
                <Input
                  ref={inputRef}
                  id="word-guess"
                  value={guess}
                  onChange={(e) => setGuess(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t("games.word.placeholder")}
                  disabled={feedback !== null}
                  className="text-center text-lg font-bold"
                  autoComplete="off"
                  spellCheck={false}
                />
                <Button
                  onClick={submitGuess}
                  disabled={!guess.trim() || feedback !== null}
                  size="lg"
                  aria-label={t("games.word.submit")}
                >
                  <Check className="h-5 w-5" />
                </Button>
              </div>

              {feedback && (
                <div
                  className={`flex items-center justify-center gap-2 rounded-lg p-3 font-semibold ${
                    feedback === "correct"
                      ? "bg-primary/10 text-primary"
                      : "bg-destructive/10 text-destructive"
                  }`}
                  role="alert"
                >
                  {feedback === "correct" ? (
                    <>
                      <Check className="h-5 w-5" />
                      {t("games.word.correct")}
                    </>
                  ) : (
                    <>
                      <X className="h-5 w-5" />
                      {t("games.word.wrong")} {gameWords[round].word}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {gameState === "end" && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">{t("games.word.complete")}</h2>
              <div className="text-5xl font-black text-primary">
                {score}/{TOTAL_ROUNDS}
              </div>

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

              <Button size="lg" onClick={startGame} className="text-lg font-bold">
                <RotateCcw className="me-2 h-5 w-5" /> {t("games.word.playAgain")}
              </Button>
            </div>
          )}
        </Card>
      </section>
    </Layout>
  );
}
