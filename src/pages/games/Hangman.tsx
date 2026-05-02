import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import heroImg from "@/assets/game-hangman.jpg";
import { useMultiplayer } from "@/hooks/useMultiplayer";
import { MultiplayerLobby } from "@/components/multiplayer/MultiplayerLobby";
import { WaitingRoom } from "@/components/multiplayer/WaitingRoom";
import { FinishBanner } from "@/components/multiplayer/OpponentPanel";
import { useAuth } from "@/contexts/AuthContext";
import { seededRng } from "@/systems/multiplayerSystem";

const WORDS = ["VISIONEX","PLATFORM","KEYBOARD","SCIENCE","MONITOR","BROWSER","NETWORK","DIGITAL","PRIVACY","STORAGE"];
const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const MAX_WRONG = 6;

// ─── Solo ────────────────────────────────────────────────────────────────────
function HangmanSolo() {
  const { t } = useLanguage();
  const { playSound } = useSound();
  const [word,    setWord]    = useState(() => WORDS[Math.floor(Math.random() * WORDS.length)]);
  const [guessed, setGuessed] = useState<Set<string>>(new Set());
  const [wrong,   setWrong]   = useState(0);

  const guess = useCallback((letter: string) => {
    if (guessed.has(letter)) return;
    const next = new Set(guessed);
    next.add(letter);
    setGuessed(next);
    if (!word.includes(letter)) { setWrong((w) => w + 1); playSound("navigate"); }
    else playSound("success");
  }, [guessed, word, playSound]);

  const display  = word.split("").map((l) => (guessed.has(l) ? l : "_")).join(" ");
  const won      = word.split("").every((l) => guessed.has(l));
  const lost     = wrong >= MAX_WRONG;
  const gameOver = won || lost;

  if (won && !lost)  toast.success(t("hangman.won"),  { id: "hw" });
  if (lost)          toast.error(t("hangman.lost"),   { id: "hl" });

  const restart = () => { setWord(WORDS[Math.floor(Math.random() * WORDS.length)]); setGuessed(new Set()); setWrong(0); playSound("start"); };

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="text-6xl font-mono tracking-[0.3em]">{display}</div>
        <Badge variant={wrong > 4 ? "destructive" : "secondary"} className="mx-auto mt-3">
          {t("hangman.attempts")}: {wrong}/{MAX_WRONG}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {ALPHA.map((l) => (
            <Button key={l} size="sm"
              variant={guessed.has(l) ? (word.includes(l) ? "default" : "destructive") : "outline"}
              disabled={guessed.has(l) || gameOver} onClick={() => guess(l)}
              className="w-10 h-10 text-lg font-bold">{l}</Button>
          ))}
        </div>
        {gameOver && (
          <div className="text-center space-y-3">
            {lost && <p className="text-lg">{t("hangman.answer")}: <strong>{word}</strong></p>}
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
      playSound("navigate");
      if (newWrong >= MAX_WRONG) finish(newWrong, false);
    } else {
      playSound("success");
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
        <CardHeader className="text-center">
          <div className="text-5xl font-mono tracking-[0.25em]">{display || "…"}</div>
          <Badge variant={wrong > 4 ? "destructive" : "secondary"} className="mx-auto mt-3">
            Mistakes: {wrong}/{MAX_WRONG}
          </Badge>
        </CardHeader>
        <CardContent>
          {finished ? (
            <p className="text-center font-bold py-4">{won ? "🎉 You got it!" : `😞 The word was: ${word}`} — Waiting for opponent…</p>
          ) : (
            <div className="flex flex-wrap justify-center gap-2">
              {ALPHA.map((l) => (
                <Button key={l} size="sm"
                  variant={guessed.has(l) ? (word.includes(l) ? "default" : "destructive") : "outline"}
                  disabled={guessed.has(l) || finished || !started} onClick={() => guess(l)}
                  className="w-10 h-10 text-lg font-bold">{l}</Button>
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
          <div className="absolute bottom-4 left-4 right-4 text-center">
            <h1 className="text-3xl font-bold">{t("hangman.title")}</h1>
            <p className="text-muted-foreground mt-1">{t("hangman.subtitle")}</p>
          </div>
        </div>
        <div className="flex rounded-lg overflow-hidden border mb-6">
          <button onClick={() => setMode("solo")}  className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "solo"  ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>🎮 Solo</button>
          <button onClick={() => setMode("multi")} className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "multi" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>👥 Online</button>
        </div>
        {mode === "solo" ? <HangmanSolo /> : <HangmanMulti />}
      </section>
    </Layout>
  );
}
