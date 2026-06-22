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
import { useState, useEffect, useCallback } from "react";
import heroImg from "@/assets/game-dreamhome.jpg";
import { useGameEconomy } from "@/components/game/GameEconomyGate";

const ROOM_KEYS = ["livingRoom", "bedroom", "kitchen", "bathroom"] as const;
type RoomKey = typeof ROOM_KEYS[number];

const ITEM_KEYS: Record<RoomKey, string[]> = {
  livingRoom: ["sofa", "tv", "plant", "painting", "lamp", "bookshelf"],
  bedroom:    ["bed", "curtains", "mirror", "decor", "nightLight", "wardrobe"],
  kitchen:    ["stove", "fridge", "dishes", "herbs", "coffeeMaker", "rack"],
  bathroom:   ["shower", "vanity", "dispenser", "mirror", "basket", "light"],
};

// Client briefs: 3 requested items per room
const CLIENT_BRIEFS: Record<RoomKey, string[]> = {
  livingRoom: ["sofa", "tv", "plant"],
  bedroom:    ["bed", "curtains", "wardrobe"],
  kitchen:    ["stove", "fridge", "coffeeMaker"],
  bathroom:   ["shower", "vanity", "light"],
};

const ROUND_SECONDS = 60;

// ─── Challenge mode ─────────────────────────────────────────────────────────────
function DreamChallenge() {
  const { t } = useLanguage();
  const { homeKnock, homeApproval, homeWrong, homeComplete } = useGameSounds();
  const { highScore, updateHighScore } = useHighScore("dreamhome");
  const { settleGameResult } = useGameEconomy();

  const [roomIdx, setRoomIdx] = useState(0);
  const [placed, setPlaced] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [done, setDone] = useState(false);
  const [newRecord, setNewRecord] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const room = ROOM_KEYS[roomIdx];
  const requested = CLIENT_BRIEFS[room];

  useEffect(() => {
    if (done || timeLeft <= 0) return;
    const timer = setTimeout(() => setTimeLeft(v => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, done]);

  useEffect(() => {
    if (timeLeft <= 0 && !done) {
      finishGame();
    }
  }, [timeLeft, done]);

  const placeItem = useCallback((item: string) => {
    if (placed.includes(item)) return;
    const isCorrect = requested.includes(item);
    const newPlaced = [...placed, item];
    setPlaced(newPlaced);

    if (isCorrect) {
      setScore(s => s + 100);
      homeKnock(); setTimeout(homeApproval, 100);
      setFeedback(t("dreamhome.correct"));
    } else {
      setScore(s => Math.max(0, s - 50));
      homeWrong();
      setFeedback(t("dreamhome.wrong"));
    }
    setTimeout(() => setFeedback(null), 1200);

    // All requested items placed → complete room
    const allPlaced = isCorrect && requested.every(r => newPlaced.includes(r));
    if (allPlaced) {
      homeComplete();
      const nextRoomIdx = roomIdx + 1;
      if (nextRoomIdx >= ROOM_KEYS.length) {
        finishGame();
      } else {
        setTimeout(() => {
          setRoomIdx(nextRoomIdx);
          setPlaced([]);
          setTimeLeft(ROUND_SECONDS);
        }, 800);
      }
    }
  }, [placed, requested, roomIdx, t]);

  function finishGame() {
    setDone(true);
    const isNew = updateHighScore(score);
    setNewRecord(isNew);
    void settleGameResult(score > 0 ? "win" : "loss", "Dream Home");
  }

  const restart = () => {
    setRoomIdx(0); setPlaced([]); setScore(0);
    setTimeLeft(ROUND_SECONDS); setDone(false); setNewRecord(false);
  };

  if (done) {
    return (
      <Card><CardContent className="pt-6 text-center space-y-4">
        <p className="text-5xl">🏠</p>
        {newRecord && <p className="text-primary font-bold animate-bounce">{t("games.newRecord")}</p>}
        <p className="text-2xl font-bold">{t("dreamhome.allDone")}</p>
        <p className="text-2xl font-bold">⭐ {score}</p>
        <p className="text-muted-foreground">{t("games.highScore")}: {highScore}</p>
        <Button size="lg" onClick={restart}>{t("dreamhome.restart")}</Button>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
        <Badge>⭐ {score}</Badge>
        <Badge variant="secondary">{t("dreamhome.roundOf").replace("{n}", String(roomIdx + 1)).replace("{total}", String(ROOM_KEYS.length))}</Badge>
        <Badge variant={timeLeft <= 10 ? "destructive" : "outline"}>⏱️ {timeLeft}s</Badge>
      </div>
      <Progress value={(timeLeft / ROUND_SECONDS) * 100}
        className={timeLeft <= 10 ? "[&>div]:bg-destructive" : ""} />

      {/* Client Brief */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="py-4">
          <p className="text-sm font-bold mb-2">📋 {t("dreamhome.clientWants")}</p>
          <div className="flex flex-wrap gap-2">
            {requested.map(item => {
              const isPlaced = placed.includes(item);
              return (
                <Badge key={item}
                  className={isPlaced ? "bg-green-500/20 text-green-600 border-green-400/40" : "bg-muted text-muted-foreground"}>
                  {isPlaced ? "✓ " : ""}{t(`dreamhome.item.${item}`)}
                </Badge>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {feedback && (
        <p className={`text-center font-bold text-sm animate-in zoom-in-95 duration-200 ${
          feedback.startsWith("✓") ? "text-green-600" : "text-destructive"
        }`}>{feedback}</p>
      )}

      {/* Room name */}
      <p className="text-center font-bold">{t(`dreamhome.room.${room}`)}</p>

      {/* Item grid */}
      <div className="grid grid-cols-3 gap-2">
        {ITEM_KEYS[room].map(item => {
          const isPlaced = placed.includes(item);
          const isRequested = requested.includes(item);
          return (
            <Button
              key={item}
              variant={isPlaced ? (isRequested ? "default" : "destructive") : "outline"}
              size="sm"
              className={`h-auto py-3 text-xs ${isPlaced ? "opacity-60 pointer-events-none" : ""}`}
              disabled={isPlaced}
              onClick={() => placeItem(item)}
            >
              {t(`dreamhome.item.${item}`)}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Free mode (original) ───────────────────────────────────────────────────────
function DreamFree() {
  const { t } = useLanguage();
  const { homeKnock, homeApproval, homeWrong } = useGameSounds();
  const [room, setRoom] = useState<RoomKey>(ROOM_KEYS[0]);
  const [placed, setPlaced] = useState<Record<string, string[]>>({});
  const [budget, setBudget] = useState(5000);

  const placeItem = (item: string) => {
    if (budget < 200) { homeWrong(); return; }
    const current = placed[room] || [];
    if (current.includes(item)) return;
    setPlaced({ ...placed, [room]: [...current, item] });
    setBudget(b => b - 200);
    homeKnock(); setTimeout(homeApproval, 200);
  };

  const totalItems = Object.values(placed).flat().length;

  return (
    <div className="space-y-4">
      <div className="flex justify-center gap-4">
        <Badge>💰 ${budget}</Badge>
        <Badge variant="secondary">🪑 {totalItems} {t("dreamhome.items")}</Badge>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {ROOM_KEYS.map(r => (
          <Button key={r} variant={room === r ? "default" : "outline"} size="sm" onClick={() => setRoom(r)}>
            {t(`dreamhome.room.${r}`)}
          </Button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card><CardContent className="pt-4">
          <p className="font-bold mb-3 text-sm">{t("dreamhome.available")}:</p>
          <div className="flex flex-wrap gap-2">
            {ITEM_KEYS[room].map(item => (
              <Button key={item} variant="outline" size="sm"
                disabled={(placed[room] || []).includes(item)}
                onClick={() => placeItem(item)}>
                {t(`dreamhome.item.${item}`)}
              </Button>
            ))}
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="font-bold mb-3 text-sm">{t("dreamhome.placed")}:</p>
          <div className="flex flex-wrap gap-2 min-h-[60px]">
            {(placed[room] || []).map(item => (
              <Badge key={item} variant="secondary">{t(`dreamhome.item.${item}`)}</Badge>
            ))}
            {!(placed[room] || []).length && <p className="text-muted-foreground text-sm">{t("dreamhome.empty")}</p>}
          </div>
        </CardContent></Card>
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────────
export default function DreamHome() {
  const { t } = useLanguage();
  const { highScore } = useHighScore("dreamhome");
  const [mode, setMode] = useState<"challenge" | "free">("challenge");

  return (
    <Layout>
      <section className="mx-auto max-w-3xl px-4 py-10">
        <div className="relative mb-6 overflow-hidden rounded-2xl">
          <img src={heroImg} alt="" role="presentation" className="h-40 w-full object-cover sm:h-48" width={800} height={512} loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute bottom-4 start-4 end-4 text-center">
            <h1 className="text-3xl font-bold">🏠 {t("dreamhome.title")}</h1>
          </div>
        </div>
        <GameHeader
          title={t("dreamhome.title")}
          highScore={highScore}
          extra={
            <HowToPlay
              titleKey="dreamhome.title"
              steps={["dreamhome.howTo.1","dreamhome.howTo.2","dreamhome.howTo.3","dreamhome.howTo.4"]}
            />
          }
        />
        <div className="flex rounded-lg overflow-hidden border mb-6">
          <button onClick={() => setMode("challenge")} className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "challenge" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
            🏆 {t("dreamhome.challengeMode")}
          </button>
          <button onClick={() => setMode("free")} className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "free" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
            🎨 {t("dreamhome.freeMode")}
          </button>
        </div>
        {mode === "challenge" ? <DreamChallenge /> : <DreamFree />}
      </section>
    </Layout>
  );
}
