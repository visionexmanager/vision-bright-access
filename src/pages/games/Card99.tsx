import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useState, useCallback } from "react";
import heroImg from "@/assets/game-card99.jpg";
import { useMultiplayer } from "@/hooks/useMultiplayer";
import { MultiplayerLobby } from "@/components/multiplayer/MultiplayerLobby";
import { WaitingRoom } from "@/components/multiplayer/WaitingRoom";
import { OpponentPanel, FinishBanner } from "@/components/multiplayer/OpponentPanel";
import { useAuth } from "@/contexts/AuthContext";

function cardValue(v: number) { return Math.min(v, 10); }
function dealHand() { return Array.from({ length: 3 }, () => Math.floor(Math.random() * 13) + 1); }
const CARD_NAMES = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

// ─── Solo ────────────────────────────────────────────────────────────────────
function Card99Solo() {
  const { t } = useLanguage();
  const { playSound } = useSound();
  const [total,    setTotal]    = useState(0);
  const [hand,     setHand]     = useState<number[]>(dealHand);
  const [score,    setScore]    = useState(0);
  const [gameOver, setGameOver] = useState(false);

  const play = useCallback((idx: number) => {
    const card = hand[idx];
    const val  = cardValue(card);
    const next = total + val;
    if (next > 99) { setGameOver(true); playSound("navigate"); return; }
    setTotal(next); setScore((s) => s + val);
    const newHand = [...hand]; newHand[idx] = Math.floor(Math.random() * 13) + 1;
    setHand(newHand); playSound("success");
  }, [hand, total, playSound]);

  const restart = () => { setTotal(0); setScore(0); setGameOver(false); setHand(dealHand()); playSound("start"); };

  return (
    <Card>
      <CardContent className="pt-6 text-center space-y-6">
        <div className="flex justify-center gap-4">
          <Badge variant={total > 85 ? "destructive" : "secondary"}>{t("card99.total")}: {total}/99</Badge>
          <Badge>⭐ {score}</Badge>
        </div>
        {gameOver ? (
          <div className="space-y-4">
            <p className="text-5xl">💥</p>
            <p className="text-2xl font-bold">{t("card99.busted")}</p>
            <p>{t("card99.finalScore")}: {score}</p>
            <Button size="lg" onClick={restart}>{t("card99.restart")}</Button>
          </div>
        ) : (
          <>
            <p className="text-6xl font-bold text-primary">{total}</p>
            <div className="flex justify-center gap-4">
              {hand.map((card, i) => (
                <Button key={i} variant="outline" className="h-24 w-16 text-xl flex-col font-bold" onClick={() => play(i)}>
                  <span>{CARD_NAMES[card]}</span>
                  <span className="text-xs text-muted-foreground">+{cardValue(card)}</span>
                </Button>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Multiplayer ─────────────────────────────────────────────────────────────
function Card99Multi() {
  const { user } = useAuth();
  const { playSound } = useSound();
  const mp = useMultiplayer("card99");

  const gs    = mp.session?.game_state as Record<string, unknown> | null;
  const total = (gs?.total as number) ?? 0;
  const hands = (gs?.hands as Record<string, number[]>) ?? {};
  const loser = (gs?.loser as string) ?? null;
  const myHand = hands[user?.id ?? ""] ?? [];
  const opp    = mp.opponents[0];

  const nextPlayer = () => {
    const all = mp.session?.players ?? [];
    return all.find((p) => p.id !== user?.id)?.id ?? user?.id ?? "";
  };

  const initState = useCallback(() => {
    const players = mp.session?.players ?? [];
    const h: Record<string, number[]> = {};
    players.forEach((p) => { h[p.id] = dealHand(); });
    return { total: 0, hands: h, loser: null };
  }, [mp.session?.players]);

  const play = useCallback((idx: number) => {
    if (!mp.isMyTurn || !user) return;
    const card = myHand[idx];
    const val  = cardValue(card);
    const next = total + val;
    if (next > 99) {
      // This player busts → they lose
      mp.makeMove({ ...gs, total: next, loser: user.id }, nextPlayer());
      mp.endGame(nextPlayer());
      playSound("navigate");
      return;
    }
    const newHands = { ...hands };
    const newHand  = [...myHand];
    newHand[idx]   = Math.floor(Math.random() * 13) + 1;
    newHands[user.id] = newHand;
    mp.makeMove({ total: next, hands: newHands, loser: null }, nextPlayer());
    playSound("success");
  }, [mp, user, myHand, total, hands, gs, playSound]);

  if (mp.status === "idle")
    return <MultiplayerLobby gameType="card99" loading={mp.loading} onCreateRoom={mp.createRoom} onJoinRoom={mp.joinRoom} />;
  if (mp.status === "waiting")
    return <WaitingRoom session={mp.session!} isHost={mp.isHost} onStart={() => mp.startGame(initState())} onLeave={mp.leaveRoom} />;
  if (mp.status === "finished")
    return <FinishBanner winnerId={mp.session!.winner_id} myId={user?.id ?? ""} players={mp.session!.players} onRematch={mp.leaveRoom} />;

  return (
    <div className="space-y-4">
      <OpponentPanel opponent={opp} isOpponentTurn={!mp.isMyTurn} label="Opponent's cards: 3" />
      <Card className={mp.isMyTurn ? "border-primary" : "opacity-70"}>
        <CardContent className="pt-6 text-center space-y-6">
          <Badge variant={total > 85 ? "destructive" : "secondary"}>Total: {total} / 99</Badge>
          <p className="text-6xl font-bold text-primary">{total}</p>
          <p className="text-sm font-medium">{mp.isMyTurn ? "Your turn — play a card" : "Waiting for opponent…"}</p>
          <div className="flex justify-center gap-4">
            {myHand.map((card, i) => (
              <Button key={i} variant="outline" className="h-24 w-16 text-xl flex-col font-bold"
                disabled={!mp.isMyTurn} onClick={() => play(i)}>
                <span>{CARD_NAMES[card]}</span>
                <span className="text-xs text-muted-foreground">+{cardValue(card)}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Card99() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<"solo" | "multi">("solo");

  return (
    <Layout>
      <section className="mx-auto max-w-2xl px-4 py-10">
        <div className="relative mb-6 overflow-hidden rounded-2xl">
          <img src={heroImg} alt="" role="presentation" className="h-40 w-full object-cover sm:h-48" width={800} height={512} loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 text-center">
            <h1 className="text-3xl font-bold">🃏 {t("card99.title")}</h1>
          </div>
        </div>
        <div className="flex rounded-lg overflow-hidden border mb-6">
          <button onClick={() => setMode("solo")}  className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "solo"  ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>🎮 Solo</button>
          <button onClick={() => setMode("multi")} className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "multi" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>👥 Online</button>
        </div>
        {mode === "solo" ? <Card99Solo /> : <Card99Multi />}
      </section>
    </Layout>
  );
}
