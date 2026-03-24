import { useState, useEffect, useCallback, useRef } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useEarnPoints } from "@/hooks/useEarnPoints";
import { usePoints } from "@/hooks/usePoints";
import { useGameAudio, useGameTTS } from "@/hooks/useGameAudio";
import {
  Trophy, RotateCcw, Play, Coins, Check, X,
  Volume2, VolumeX, Mic, MicOff, Lightbulb, Ear
} from "lucide-react";
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
  const { playSound, setEnabled: setSoundEnabled, enabledRef: soundEnabledRef } = useGameAudio();
  const { speak, setEnabled: setTTSEnabled, stop: stopTTS, enabledRef: ttsEnabledRef } = useGameTTS();

  const wordList = lang === "ar" ? WORDS_AR : lang === "es" ? WORDS_ES : WORDS_EN;

  const [gameWords, setGameWords] = useState<WordEntry[]>([]);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [scrambled, setScrambled] = useState("");
  const [selectedLetters, setSelectedLetters] = useState<number[]>([]);
  const [answer, setAnswer] = useState<string[]>([]);
  const [scrambledArr, setScrambledArr] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [gameState, setGameState] = useState<GameState>("start");
  const [pointsAwarded, setPointsAwarded] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [ttsOn, setTTSOn] = useState(true);
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
    setFeedback(null);
    setPointsAwarded(false);
    setShowHint(false);
    setSelectedLetters([]);
    setAnswer([]);
    const s = scramble(words[0].word);
    setScrambled(s);
    setScrambledArr(s.split(""));
    setGameState("playing");
    playSound("tick");
  };

  useEffect(() => {
    if (gameState === "playing" && gameWords[round]) {
      const s = scramble(gameWords[round].word);
      setScrambled(s);
      setScrambledArr(s.split(""));
      setSelectedLetters([]);
      setAnswer([]);
      setFeedback(null);
      setShowHint(false);
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

  const selectLetter = (index: number) => {
    if (selectedLetters.includes(index) || feedback !== null) return;
    playSound("select");
    const letter = scrambledArr[index];
    const newSelected = [...selectedLetters, index];
    const newAnswer = [...answer, letter];
    setSelectedLetters(newSelected);
    setAnswer(newAnswer);

    announce(`${t("games.word.letterPlaced")}: ${letter}`);
    if (ttsOn) speak(letter, lang);

    // Check if word is complete
    if (newAnswer.length === gameWords[round].word.length) {
      const guess = newAnswer.join("");
      const correct = guess.toUpperCase() === gameWords[round].word.toUpperCase() || guess === gameWords[round].word;
      
      if (correct) {
        setScore((p) => p + 1);
        setFeedback("correct");
        playSound("correct");
        announce(t("games.word.correct"));
        if (ttsOn) speak(t("games.word.correct"), lang);
      } else {
        setFeedback("wrong");
        playSound("wrong");
        announce(`${t("games.word.wrong")} ${gameWords[round].word}`);
        if (ttsOn) speak(`${t("games.word.wrong")} ${gameWords[round].word}`, lang);
      }

      setTimeout(() => {
        if (round + 1 < TOTAL_ROUNDS) {
          setRound((p) => p + 1);
        } else {
          setGameState("end");
          playSound("complete");
          if (ttsOn) speak(t("games.word.complete"), lang);
        }
      }, 1500);
    } else {
      playSound("place");
    }
  };

  const removeLetter = (answerIndex: number) => {
    if (feedback !== null) return;
    playSound("tick");
    const origIndex = selectedLetters[answerIndex];
    setSelectedLetters((prev) => prev.filter((_, i) => i !== answerIndex));
    setAnswer((prev) => prev.filter((_, i) => i !== answerIndex));
    announce(`${t("games.word.letterRemoved")}`);
  };

  const handleHint = () => {
    setShowHint(true);
    playSound("hint");
    if (ttsOn) speak(`${t("games.word.hintLabel")} ${gameWords[round].hint}`, lang);
    announce(`${t("games.word.hintLabel")} ${gameWords[round].hint}`);
  };

  const handleReadWord = () => {
    const letters = scrambledArr.join(", ");
    speak(`${t("games.word.scrambledLetters")}: ${letters}`, lang);
    announce(`${t("games.word.scrambledLetters")}: ${letters}`);
  };

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
  };

  const toggleTTS = () => {
    const next = !ttsOn;
    setTTSOn(next);
    setTTSEnabled(next);
    if (!next) stopTTS();
  };

  const progress = gameState === "playing" ? ((round + 1) / TOTAL_ROUNDS) * 100 : 0;
  const reward = getPointsReward(score, TOTAL_ROUNDS);

  return (
    <Layout>
      <div ref={liveRef} aria-live="assertive" aria-atomic="true" className="sr-only" />

      <section className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center px-4 py-12">
        <Card className="w-full border-2 border-primary/30 p-6 sm:p-8 text-center">
          {/* Audio controls */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <button
              onClick={toggleSound}
              className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label={soundOn ? t("games.memory.soundOff") : t("games.memory.soundOn")}
            >
              {soundOn ? <Volume2 className="h-4 w-4 text-primary" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
              <span className="hidden sm:inline">{soundOn ? t("games.memory.soundOn") : t("games.memory.soundOff")}</span>
            </button>
            <button
              onClick={toggleTTS}
              className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label={ttsOn ? t("games.memory.ttsOff") : t("games.memory.ttsOn")}
            >
              {ttsOn ? <Mic className="h-4 w-4 text-primary" /> : <MicOff className="h-4 w-4 text-muted-foreground" />}
              <span className="hidden sm:inline">{ttsOn ? t("games.memory.ttsOn") : t("games.memory.ttsOff")}</span>
            </button>
          </div>

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
            <div className="space-y-5">
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

              {/* Hint area */}
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleHint}
                  disabled={showHint}
                  className="text-xs"
                >
                  <Lightbulb className="h-4 w-4 me-1" />
                  {t("games.word.hintLabel")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReadWord}
                  className="text-xs"
                  aria-label={t("games.word.readAloud")}
                >
                  <Ear className="h-4 w-4 me-1" />
                  {t("games.word.readAloud")}
                </Button>
              </div>

              {showHint && (
                <p className="text-lg font-semibold text-foreground animate-in fade-in" aria-live="polite">
                  💡 {gameWords[round].hint}
                </p>
              )}

              {/* Answer slots */}
              <div
                className="flex flex-wrap items-center justify-center gap-2 min-h-[56px] rounded-xl border-2 border-dashed border-primary/30 p-3 bg-muted/50"
                aria-label={t("games.word.yourAnswer")}
              >
                {gameWords[round].word.split("").map((_, i) => (
                  <button
                    key={i}
                    onClick={() => answer[i] && removeLetter(i)}
                    disabled={!answer[i] || feedback !== null}
                    className={`
                      flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg border-2 text-lg sm:text-xl font-black transition-all
                      focus:outline-none focus:ring-2 focus:ring-primary
                      ${answer[i]
                        ? feedback === "correct"
                          ? "border-primary bg-primary/20 text-primary"
                          : feedback === "wrong"
                          ? "border-destructive bg-destructive/20 text-destructive"
                          : "border-primary bg-primary/10 text-foreground hover:bg-destructive/10 cursor-pointer"
                        : "border-border bg-background text-muted-foreground"
                      }
                    `}
                    aria-label={answer[i] ? `${answer[i]}, ${t("games.word.clickToRemove")}` : `${t("games.word.emptySlot")} ${i + 1}`}
                  >
                    {answer[i] || "·"}
                  </button>
                ))}
              </div>

              {/* Scrambled letters */}
              <div
                className="flex flex-wrap items-center justify-center gap-2"
                role="group"
                aria-label={t("games.word.scrambledLetters")}
              >
                {scrambledArr.map((letter, i) => {
                  const isUsed = selectedLetters.includes(i);
                  return (
                    <button
                      key={i}
                      onClick={() => selectLetter(i)}
                      disabled={isUsed || feedback !== null}
                      className={`
                        flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl border-2 text-xl sm:text-2xl font-black
                        transition-all duration-200 transform
                        focus:outline-none focus:ring-4 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background
                        ${isUsed
                          ? "border-border bg-muted/30 text-muted-foreground/30 scale-90 cursor-default"
                          : "border-primary/50 bg-card text-foreground hover:border-primary hover:bg-primary/10 hover:scale-110 active:scale-95 cursor-pointer shadow-sm"
                        }
                      `}
                      aria-label={isUsed ? `${letter}, ${t("games.word.alreadyUsed")}` : letter}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>

              {feedback && (
                <div
                  className={`flex items-center justify-center gap-2 rounded-lg p-3 font-semibold animate-in fade-in ${
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
