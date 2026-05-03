import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useState, useEffect, useCallback } from "react";
import heroImg from "@/assets/game-starchef.jpg";
import { useMultiplayer } from "@/hooks/useMultiplayer";
import { MultiplayerLobby } from "@/components/multiplayer/MultiplayerLobby";
import { WaitingRoom } from "@/components/multiplayer/WaitingRoom";
import { FinishBanner } from "@/components/multiplayer/OpponentPanel";
import { useAuth } from "@/contexts/AuthContext";
import { seededRng } from "@/systems/multiplayerSystem";

const ORDERS = [
  { name: "🍔 Burger", items: ["🥩", "🧅", "🍅", "🥬", "🧀"] },
  { name: "🍕 Pizza", items: ["🫓", "🧀", "🍅", "🫒", "🌿"] },
  { name: "🌮 Taco", items: ["🫓", "🥩", "🧅", "🍅", "🌶️"] },
  { name: "🥗 Salad", items: ["🥬", "🍅", "🧅", "🫒", "🧀"] },
  { name: "🍣 Sushi", items: ["🍚", "🐟", "🥑", "🥒", "🫚"] },
];

const ALL_INGREDIENTS = ["🥩", "🧅", "🍅", "🥬", "🧀", "🫓", "🫒", "🌿", "🌶️", "🍚", "🐟", "🥑", "🥒", "🫚"];
const ROUND_SECONDS = 30;

function orderFromSeed(seed: number, served: number) {
  const rng = seededRng(seed + served * 997);
  return ORDERS[Math.floor(rng() * ORDERS.length) % ORDERS.length];
}

function ChefBoard({
  order,
  plate,
  timeLeft,
  onAddItem,
}: {
  order: (typeof ORDERS)[number];
  plate: string[];
  timeLeft: number;
  onAddItem: (item: string) => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-lg font-bold mb-2">{t("starchef.order")}: {order.name}</p>
          <div className="flex justify-center gap-2 text-3xl">{order.items.map((it, i) => <span key={i}>{it}</span>)}</div>
          <Progress value={(timeLeft / ROUND_SECONDS) * 100} className="mt-4" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <p className="text-center mb-3 text-sm text-muted-foreground">{t("starchef.yourPlate")}:</p>
          <div className="flex justify-center gap-2 text-3xl min-h-[48px]">
            {plate.map((it, i) => <span key={i}>{it}</span>)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap justify-center gap-2">
            {ALL_INGREDIENTS.map((item) => (
              <Button key={item} variant="outline" className="text-2xl h-14 w-14" onClick={() => onAddItem(item)}>{item}</Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StarChefSolo() {
  const { t } = useLanguage();
  const { playSound } = useSound();
  const [order, setOrder] = useState(() => ORDERS[0]);
  const [plate, setPlate] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [gameActive, setGameActive] = useState(false);

  const start = () => {
    setScore(0);
    setTimeLeft(ROUND_SECONDS);
    setPlate([]);
    setOrder(ORDERS[Math.floor(Math.random() * ORDERS.length)]);
    setGameActive(true);
    playSound("start");
  };

  useEffect(() => {
    if (!gameActive || timeLeft <= 0) return;
    const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [gameActive, timeLeft]);

  useEffect(() => {
    if (timeLeft <= 0 && gameActive) {
      setGameActive(false);
      playSound("navigate");
    }
  }, [timeLeft, gameActive, playSound]);

  const addItem = useCallback((item: string) => {
    if (!gameActive) return;
    const next = [...plate, item];
    setPlate(next);
    if (next.length === order.items.length) {
      const correct = next.every((it, i) => it === order.items[i]);
      if (correct) {
        setScore((s) => s + 100);
        playSound("success");
        setPlate([]);
        setOrder(ORDERS[Math.floor(Math.random() * ORDERS.length)]);
      } else {
        playSound("navigate");
        setPlate([]);
      }
    }
  }, [gameActive, plate, order, playSound]);

  if (!gameActive && timeLeft === ROUND_SECONDS) {
    return <Card><CardContent className="pt-6 text-center"><Button size="lg" onClick={start}>{t("starchef.start")}</Button></CardContent></Card>;
  }

  if (!gameActive) {
    return (
      <Card><CardContent className="pt-6 text-center space-y-4">
        <p className="text-5xl">🏆</p>
        <p className="text-2xl font-bold">{t("starchef.finalScore")}: {score}</p>
        <Button size="lg" onClick={start}>{t("starchef.restart")}</Button>
      </CardContent></Card>
    );
  }

  return <ChefBoard order={order} plate={plate} timeLeft={timeLeft} onAddItem={addItem} />;
}

function StarChefMulti() {
  const { user } = useAuth();
  const { playSound } = useSound();
  const mp = useMultiplayer("starchef");
  const [plate, setPlate] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [served, setServed] = useState(0);
  const [finished, setFinished] = useState(false);

  const gs = mp.session?.game_state as Record<string, unknown> | null;
  const seed = (gs?.seed as number) ?? 1;
  const order = orderFromSeed(seed, served);
  const opp = mp.opponents[0];
  const oppScore = mp.session?.players.find((p) => p.id !== user?.id)?.score ?? 0;
  const bothDone = gs && user && opp ? gs[`fin_${user.id}`] === true && gs[`fin_${opp.id}`] === true : false;

  useEffect(() => {
    if (mp.status !== "playing" || finished || timeLeft <= 0) return;
    const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [mp.status, finished, timeLeft]);

  useEffect(() => {
    if (mp.status === "playing" && timeLeft <= 0 && !finished) {
      setFinished(true);
      mp.updateMyScore(score, true);
      playSound("navigate");
    }
  }, [timeLeft, finished, mp, score, playSound]);

  useEffect(() => {
    if (bothDone && mp.status === "playing") {
      const sorted = [...mp.session!.players].sort((a, b) => b.score - a.score);
      mp.endGame(sorted[0].score !== sorted[1]?.score ? sorted[0].id : undefined);
    }
  }, [bothDone, mp]);

  const addItem = (item: string) => {
    if (finished || mp.status !== "playing") return;
    const next = [...plate, item];
    setPlate(next);
    if (next.length === order.items.length) {
      const correct = next.every((it, i) => it === order.items[i]);
      if (correct) {
        const nextScore = score + 100;
        setScore(nextScore);
        setServed((s) => s + 1);
        mp.updateMyScore(nextScore, false);
        playSound("success");
      } else {
        playSound("navigate");
      }
      setPlate([]);
    }
  };

  if (mp.status === "idle")
    return <MultiplayerLobby gameType="starchef" loading={mp.loading} onCreateRoom={mp.createRoom} onJoinRoom={mp.joinRoom} />;
  if (mp.status === "waiting")
    return <WaitingRoom session={mp.session!} isHost={mp.isHost} onStart={() => mp.startGame({ seed: Math.floor(Math.random() * 999999) })} onLeave={mp.leaveRoom} />;
  if (mp.status === "finished")
    return <FinishBanner winnerId={mp.session!.winner_id} myId={user?.id ?? ""} players={mp.session!.players} onRematch={mp.leaveRoom} />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between rounded-lg border p-3 text-sm">
        <div className="text-center"><p className="text-xs text-muted-foreground">You</p><p className="text-xl font-bold text-primary">{score}</p></div>
        <Badge variant={timeLeft < 10 ? "destructive" : "secondary"}>⏱️ {timeLeft}s</Badge>
        <div className="text-center"><p className="text-xs text-muted-foreground">{opp?.name ?? "Opponent"}</p><p className="text-xl font-bold">{oppScore}</p></div>
      </div>
      {finished ? (
        <Card><CardContent className="pt-6 text-center space-y-2">
          <p className="text-xl font-bold">Done! ✅</p>
          <p className="text-muted-foreground">Score: {score} — Waiting for opponent…</p>
        </CardContent></Card>
      ) : (
        <ChefBoard order={order} plate={plate} timeLeft={timeLeft} onAddItem={addItem} />
      )}
    </div>
  );
}

export default function StarChef() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<"solo" | "multi">("solo");

  return (
    <Layout>
      <section className="mx-auto max-w-2xl px-4 py-10">
        <div className="relative mb-6 overflow-hidden rounded-2xl">
          <img src={heroImg} alt="" role="presentation" className="h-40 w-full object-cover sm:h-48" width={800} height={512} loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 text-center">
            <h1 className="text-3xl font-bold">👨‍🍳 {t("starchef.title")}</h1>
          </div>
        </div>
        <div className="flex rounded-lg overflow-hidden border mb-6">
          <button onClick={() => setMode("solo")} className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "solo" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>🎮 Solo</button>
          <button onClick={() => setMode("multi")} className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "multi" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>👥 Online</button>
        </div>
        {mode === "solo" ? <StarChefSolo /> : <StarChefMulti />}
      </section>
    </Layout>
  );
}
