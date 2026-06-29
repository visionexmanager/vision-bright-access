import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useGameSounds } from "@/hooks/useGameSounds";
import { useHighScore } from "@/hooks/useHighScore";
import { GameHeader } from "@/components/game/GameHeader";
import { HowToPlay } from "@/components/game/HowToPlay";
import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import heroImg from "@/assets/game-hangman.jpg";
import { useMultiplayer } from "@/hooks/useMultiplayer";
import { MultiplayerLobby } from "@/components/multiplayer/MultiplayerLobby";
import { WaitingRoom } from "@/components/multiplayer/WaitingRoom";
import { FinishBanner } from "@/components/multiplayer/OpponentPanel";
import { useAuth } from "@/contexts/AuthContext";
import { seededRng } from "@/systems/multiplayerSystem";
import { useGameEconomy } from "@/components/game/GameEconomyGate";

const WORDS = [
  "VISIONEX","PLATFORM","KEYBOARD","SCIENCE","MONITOR","BROWSER","NETWORK",
  "DIGITAL","PRIVACY","STORAGE","ACCESSIBLE","LANGUAGE","COMMUNITY",
  "SERVICES","DASHBOARD","LEARNING","CREATIVITY","ADVENTURE","KNOWLEDGE",
  "DISCOVERY","CHALLENGE","EXCELLENCE","INNOVATION","TECHNOLOGY","EDUCATION",
  "MARKETPLACE","SIMULATION","ACHIEVEMENT","EXPERIENCE","DEVELOPMENT",
];
const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const MAX_WRONG = 6;

// ─── SVG Gallows ─────────────────────────────────────────────────────────────
function HangmanFigure({ wrong }: { wrong: number }) {
  const stroke = "currentColor";
  const sw = 3.5;
  const won = false; // figure is rendered per wrong count only
  return (
    <svg
      viewBox="0 0 200 240"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full max-w-[180px] mx-auto my-2 text-foreground"
      aria-label={`Hangman: ${wrong} wrong guesses`}
    >
      {/* Gallows structure — always visible */}
      <line x1="10" y1="230" x2="190" y2="230" stroke={stroke} strokeWidth="5" strokeLinecap="round" />
      <line x1="60"  y1="230" x2="60"  y2="15"  stroke={stroke} strokeWidth="5" strokeLinecap="round" />
      <line x1="60"  y1="15"  x2="140" y2="15"  stroke={stroke} strokeWidth="5" strokeLinecap="round" />
      <line x1="140" y1="15"  x2="140" y2="45"  stroke={stroke} strokeWidth="3" strokeLinecap="round" strokeDasharray="4 3" />

      {/* Head */}
      {wrong >= 1 && (
        <circle cx="140" cy="65" r="20" stroke={stroke} strokeWidth={sw} fill="none"
          className="transition-all duration-500 animate-in zoom-in-95" />
      )}
      {/* Eyes on head when lost */}
      {wrong >= 6 && (
        <>
          <line x1="133" y1="59" x2="137" y2="63" stroke={stroke} strokeWidth="2" />
          <line x1="137" y1="59" x2="133" y2="63" stroke={stroke} strokeWidth="2" />
          <line x1="143" y1="59" x2="147" y2="63" stroke={stroke} strokeWidth="2" />
          <line x1="147" y1="59" x2="143" y2="63" stroke={stroke} strokeWidth="2" />
          <path d="M133 73 Q140 70 147 73" stroke={stroke} strokeWidth="2" fill="none" />
        </>
      )}
      {/* Body */}
      {wrong >= 2 && (
        <line x1="140" y1="85" x2="140" y2="145"
          stroke={stroke} strokeWidth={sw} strokeLinecap="round"
          className="transition-all duration-300" />
      )}
      {/* Left arm */}
      {wrong >= 3 && (
        <line x1="140" y1="100" x2="112" y2="128"
          stroke={stroke} strokeWidth={sw} strokeLinecap="round"
          className="transition-all duration-300" />
      )}
      {/* Right arm */}
      {wrong >= 4 && (
        <line x1="140" y1="100" x2="168" y2="128"
          stroke={stroke} strokeWidth={sw} strokeLinecap="round"
          className="transition-all duration-300" />
      )}
      {/* Left leg */}
      {wrong >= 5 && (
        <line x1="140" y1="145" x2="112" y2="185"
          stroke={stroke} strokeWidth={sw} strokeLinecap="round"
          className="transition-all duration-300" />
      )}
      {/* Right leg */}
      {wrong >= 6 && (
        <line x1="140" y1="145" x2="168" y2="185"
          stroke={stroke} strokeWidth={sw} strokeLinecap="round"
          className="transition-all duration-300" />
      )}
    </svg>
  );
}

// ─── Solo ────────────────────────────────────────────────────────────────────
function HangmanSolo() {
  const { t } = useLanguage();
  const { playSound } = useSound();
  const { hangmanCorrect, hangmanWrong, hangmanWin, hangmanGameOver } = useGameSounds();
  const { settleGameResult } = useGameEconomy();
  const [word,    setWord]    = useState(() => WORDS[Math.floor(Math.random() * WORDS.length)]);
  const [guessed, setGuessed] = useState<Set<string>>(new Set());
  const [wrong,   setWrong]   = useState(0);

  const guess = useCallback((letter: string) => {
    if (guessed.has(letter)) return;
    const next = new Set(guessed);
    next.add(letter);
    setGuessed(next);
    if (!word.includes(letter)) { setWrong((w) => w + 1); hangmanWrong(); }
    else hangmanCorrect();
  }, [guessed, word, playSound]);

  const display  = word.split("").map((l) => (guessed.has(l) ? l : "_")).join(" ");
  const won      = word.split("").every((l) => guessed.has(l));
  const lost     = wrong >= MAX_WRONG;
  const gameOver = won || lost;

  useEffect(() => {
    if (won && !lost) {
      toast.success(t("hangman.won"), { id: "hw" });
      hangmanWin();
      void settleGameResult("win", "Hangman");
    }
    if (lost) {
      toast.error(t("hangman.lost"), { id: "hl" });
      hangmanGameOver();
      void settleGameResult("loss", "Hangman");
    }
  }, [lost, won]);

  const restart = () => { setWord(WORDS[Math.floor(Math.random() * WORDS.length)]); setGuessed(new Set()); setWrong(0); };

  return (
    <Card>
      <CardContent className="pt-4">
        {/* Gallows + figure */}
        <div className={`rounded-xl p-3 mb-4 border ${won ? "border-green-500/40 bg-green-50/10" : lost ? "border-destructive/40 bg-destructive/5" : "border-border bg-muted/30"}`}>
          <HangmanFigure wrong={wrong} />
        </div>

        {/* Word display */}
        <div className="text-center mb-4">
          <div className={`text-4xl sm:text-5xl font-mono tracking-[0.3em] transition-colors ${won ? "text-green-500" : lost ? "text-destructive" : ""}`}>
            {display}
          </div>
          <Badge variant={wrong > 4 ? "destructive" : "secondary"} className="mt-3">
            {wrong}/{MAX_WRONG} {t("hangman.attempts")}
          </Badge>
        </div>

        {/* Keyboard */}
        <div className="flex flex-wrap justify-center gap-1.5 mb-4">
          {ALPHA.map((l) => (
            <Button key={l} size="sm"
              variant={guessed.has(l) ? (word.includes(l) ? "default" : "destructive") : "outline"}
              disabled={guessed.has(l) || gameOver} onClick={() => guess(l)}
              className="w-9 h-9 text-sm font-bold transition-all active:scale-90 hover:scale-105">{l}</Button>
          ))}
        </div>

        {gameOver && (
          <div className="text-center space-y-3 pt-2 border-t">
            {lost && (
              <p className="text-muted-foreground">
                {t("hangman.answer")}: <strong className="text-foreground">{word}</strong>
              </p>
            )}
            {won && <p className="text-green-500 font-bold text-lg">🎉 {t("hangman.won")}</p>}
            <Button size="lg" onClick={restart}>{t("hangman.restart")}</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Multiplayer (both guess the same word, fewer wrong guesses wins) ─────────
function HangmanMulti() {
  const { user } = useAuth();
  const { playSound } = useSound();
  const { hangmanCorrect, hangmanWrong } = useGameSounds();
  const mp = useMultiplayer("hangman");

  // Each player has their own private guess state (not stored in DB for fairness)
  const [guessed,  setGuessed]  = useState<Set<string>>(new Set());
  const [wrong,    setWrong]    = useState(0);
  const [finished, setFinished] = useState(false);
  const [started,  setStarted]  = useState(false);

  const gs    = mp.session?.game_state as Record<string, unknown> | null;
  const seed  = (gs?.seed as number) ?? 0;
  const word  = seed > 0 ? WORDS[seed % WORDS.length] : "";
  const opp   = mp.opponents[0];
  const oppScore = mp.session?.players.find((p) => p.id !== user?.id)?.score ?? 0;
  const bothDone = gs && user && opp
    ? gs[`fin_${user.id}`] === true && gs[`fin_${opp.id}`] === true
    : false;

  // When game starts, reset local state
  useEffect(() => {
    if (mp.status === "playing" && !started) {
      setStarted(true);
      setGuessed(new Set());
      setWrong(0);
      setFinished(false);
    }
  }, [mp.status, started]);

  // Both done → determine winner (fewer wrong guesses wins; lower is better)
  useEffect(() => {
    if (bothDone && mp.status === "playing") {
      const allPlayers = mp.session!.players;
      // Score is stored as (MAX_WRONG - wrong) so higher = better
      const sorted = [...allPlayers].sort((a, b) => b.score - a.score);
      mp.endGame(sorted[0].score !== sorted[1]?.score ? sorted[0].id : undefined);
    }
  }, [bothDone, mp]);

  const display = word.split("").map((l) => (guessed.has(l) ? l : "_")).join(" ");
  const won     = word.length > 0 && word.split("").every((l) => guessed.has(l));
  const lost    = wrong >= MAX_WRONG;

  const finish = useCallback((w: number, win: boolean) => {
    setFinished(true);
    // Higher score = fewer mistakes = better
    const scoreValue = win ? MAX_WRONG * 10 : (MAX_WRONG - w);
    mp.updateMyScore(scoreValue, true);
  }, [mp]);

  const guess = useCallback((letter: string) => {
    if (guessed.has(letter) || finished || !started) return;
    const next = new Set(guessed);
    next.add(letter);
    setGuessed(next);
    if (!word.includes(letter)) {
      const newWrong = wrong + 1;
      setWrong(newWrong);
      hangmanWrong();
      if (newWrong >= MAX_WRONG) finish(newWrong, false);
    } else {
      hangmanCorrect();
      const allRevealed = word.split("").every((l) => next.has(l));
      if (allRevealed) finish(wrong, true);
    }
  }, [guessed, word, wrong, finished, started, playSound, finish]);

  if (mp.status === "idle")
    return <MultiplayerLobby gameType="hangman" loading={mp.loading} onCreateRoom={mp.createRoom} onJoinRoom={mp.joinRoom} />;
  if (mp.status === "waiting")
    return <WaitingRoom session={mp.session!} isHost={mp.isHost}
      onStart={() => mp.startGame({ seed: Math.floor(Math.random() * WORDS.length * 997 + 1) })} onLeave={mp.leaveRoom} />;
  if (mp.status === "finished")
    return <FinishBanner winnerId={mp.session!.winner_id} myId={user?.id ?? ""} players={mp.session!.players} onRematch={mp.leaveRoom} />;

  return (
    <div className="space-y-4">
      {/* Scoreboard */}
      <div className="flex justify-between rounded-lg border p-3 text-sm">
        <div className="text-center"><p className="text-xs text-muted-foreground">You</p>
          <Badge variant={wrong > 4 ? "destructive" : "secondary"}>{wrong}/{MAX_WRONG} wrong</Badge></div>
        <div className="text-center self-center text-muted-foreground text-xs">same word</div>
        <div className="text-center"><p className="text-xs text-muted-foreground">{opp?.name ?? "Opponent"}</p>
          {opp && gs?.[`fin_${opp.id}`] ? <Badge variant="default" className="text-xs">Done ✓</Badge> : <Badge variant="outline" className="text-xs">Playing…</Badge>}
        </div>
      </div>

      <Card>
        <CardContent className="pt-4">
          <HangmanFigure wrong={wrong} />
          <div className="text-center mb-3">
            <div className="text-4xl font-mono tracking-[0.25em]">{display || "…"}</div>
            <Badge variant={wrong > 4 ? "destructive" : "secondary"} className="mt-2">
              {wrong}/{MAX_WRONG} mistakes
            </Badge>
          </div>
          {finished ? (
            <p className="text-center font-bold py-4">{won ? "🎉 You got it!" : `😞 The word was: ${word}`} — Waiting for opponent…</p>
          ) : (
            <div className="flex flex-wrap justify-center gap-1.5">
              {ALPHA.map((l) => (
                <Button key={l} size="sm"
                  variant={guessed.has(l) ? (word.includes(l) ? "default" : "destructive") : "outline"}
                  disabled={guessed.has(l) || finished || !started} onClick={() => guess(l)}
                  className="w-9 h-9 text-sm font-bold">{l}</Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Hangman() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<"solo" | "multi">("solo");

  return (
    <Layout>
      <section className="mx-auto max-w-2xl px-4 py-10">
        <div className="relative mb-8 overflow-hidden rounded-2xl">
          <img src={heroImg} alt="" role="presentation" className="h-40 w-full object-cover sm:h-48" width={800} height={512} loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute bottom-4 start-4 end-4 text-center">
            <h1 className="text-3xl font-bold">{t("hangman.title")}</h1>
            <p className="text-muted-foreground mt-1">{t("hangman.subtitle")}</p>
          </div>
        </div>
        <GameHeader
          title={t("hangman.title")}
          extra={
            <HowToPlay
              titleKey="hangman.title"
              steps={["hangman.howTo.1","hangman.howTo.2","hangman.howTo.3","hangman.howTo.4"]}
            />
          }
        />
        <div className="flex rounded-lg overflow-hidden border mb-6">
          <button onClick={() => setMode("solo")}  className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "solo"  ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>🎮 Solo</button>
          <button onClick={() => setMode("multi")} className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "multi" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>👥 Online</button>
        </div>
        {mode === "solo" ? <HangmanSolo /> : <HangmanMulti />}
      </section>
    </Layout>
  );
}
