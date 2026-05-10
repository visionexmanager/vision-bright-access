import { useState, useEffect, useCallback, useRef } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePoints } from "@/hooks/usePoints";
import { useGameAudio, useGameTTS } from "@/hooks/useGameAudio";
import {
  Trophy, RotateCcw, Play, Coins, Check, X,
  Volume2, VolumeX, Mic, MicOff, Lightbulb, Ear
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { WatchAdButton } from "@/components/WatchAdButton";

interface WordEntry {
  wordKey: string;
  hintKey: string;
}

const WORDS: WordEntry[] = [
  { wordKey: "word.entry.keyboard.word", hintKey: "word.entry.keyboard.hint" },
  { wordKey: "word.entry.contrast.word", hintKey: "word.entry.contrast.hint" },
  { wordKey: "word.entry.braille.word", hintKey: "word.entry.braille.hint" },
  { wordKey: "word.entry.website.word", hintKey: "word.entry.website.hint" },
  { wordKey: "word.entry.design.word", hintKey: "word.entry.design.hint" },
  { wordKey: "word.entry.screen.word", hintKey: "word.entry.screen.hint" },
  { wordKey: "word.entry.speech.word", hintKey: "word.entry.speech.hint" },
  { wordKey: "word.entry.access.word", hintKey: "word.entry.access.hint" },
  { wordKey: "word.entry.vision.word", hintKey: "word.entry.vision.hint" },
  { wordKey: "word.entry.cursor.word", hintKey: "word.entry.cursor.hint" },
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

// points from games removed — earn VX via Watch Ad or simulations
}

type GameState = "start" | "playing" | "end";
const TOTAL_ROUNDS = 8;

export default function WordPuzzle() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const { totalPoints } = usePoints();
  const { playSound, setEnabled: setSoundEnabled, enabledRef: soundEnabledRef } = useGameAudio();
  const { speak, setEnabled: setTTSEnabled, stop: stopTTS, enabledRef: ttsEnabledRef } = useGameTTS();

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
  const [soundOn, setSoundOn] = useState(true);
  const [ttsOn, setTTSOn] = useState(true);
  const liveRef = useRef<HTMLDivElement>(null);

  const announce = useCallback((msg: string) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  }, []);

  const pickWords = useCallback(() => {
    const shuffled = [...WORDS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, TOTAL_ROUNDS);
  }, []);

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
    const s = scramble(t(words[0].wordKey));
    setScrambled(s);
    setScrambledArr(s.split(""));
    setGameState("playing");
    playSound("tick");
  };

  useEffect(() => {
    if (gameState === "playing" && gameWords[round]) {
      const s = scramble(t(gameWords[round].wordKey));
      setScrambled(s);
      setScrambledArr(s.split(""));
      setSelectedLetters([]);
      setAnswer([]);
      setFeedback(null);
      setShowHint(false);
    }
  }, [round, gameState, gameWords, t]);


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
    const currentWord = t(gameWords[round].wordKey);
    if (newAnswer.length === currentWord.length) {
      const guess = newAnswer.join("");
      const correct = guess.toUpperCase() === currentWord.toUpperCase() || guess === currentWord;
      
      if (correct) {
        setScore((p) => p + 1);
        setFeedback("correct");
        playSound("correct");
        announce(t("games.word.correct"));
        if (ttsOn) speak(t("games.word.correct"), lang);
      } else {
        setFeedback("wrong");
        playSound("wrong");
        announce(`${t("games.word.wrong")} ${currentWord}`);
        if (ttsOn) speak(`${t("games.word.wrong")} ${currentWord}`, lang);
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
    const hint = t(gameWords[round].hintKey);
    if (ttsOn) speak(`${t("games.word.hintLabel")} ${hint}`, lang);
    announce(`${t("games.word.hintLabel")} ${hint}`);
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
  return (
    <Layout>
      <div ref={liveRef} aria-live="assertive" aria-atomic="true" className="sr-only" />
      <WatchAdButton variant="float" />

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
                  💡 {t(gameWords[round].hintKey)}
                </p>
              )}

              {/* Answer slots */}
              <div
                className="flex flex-wrap items-center justify-center gap-2 min-h-[56px] rounded-xl border-2 border-dashed border-primary/30 p-3 bg-muted/50"
                aria-label={t("games.word.yourAnswer")}
              >
                {t(gameWords[round].wordKey).split("").map((_, i) => (
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
                      {t("games.word.wrong")} {t(gameWords[round].wordKey)}
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
