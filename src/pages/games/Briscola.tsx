import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useState, useCallback, useEffect } from "react";
import heroImg from "@/assets/game-briscola.jpg";
import { useMultiplayer } from "@/hooks/useMultiplayer";
import { MultiplayerLobby } from "@/components/multiplayer/MultiplayerLobby";
import { WaitingRoom } from "@/components/multiplayer/WaitingRoom";
import { OpponentPanel, FinishBanner } from "@/components/multiplayer/OpponentPanel";
import { useAuth } from "@/contexts/AuthContext";

const SUITS  = ["🟡", "🔴", "🟢", "🔵"];
const VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
type BCard = { suit: string; value: number };

function createDeck(): BCard[] {
  return SUITS.flatMap((s) => VALUES.map((v) => ({ suit: s, value: v }))).sort(() => Math.random() - 0.5);
}

// ─── Solo ────────────────────────────────────────────────────────────────────
function BriscolaSolo() {
  const { t } = useLanguage();
  const { playSound } = useSound();
  const [deck]  = useState(createDeck);
  const [hand,  setHand]     = useState<BCard[]>(() => deck.slice(0, 3));
  const [cpuHand]            = useState<BCard[]>(() => deck.slice(3, 6));
  const [trump]              = useState(() => deck[deck.length - 1]);
  const [played, setPlayed]  = useState<BCard | null>(null);
  const [cpuPlayed, setCpuPlayed] = useState<BCard | null>(null);
  const [score, setScore]    = useState(0);

  const play = useCallback((idx: number) => {
    const card = hand[idx];
    setPlayed(card);
    const cpu = cpuHand[Math.floor(Math.random() * cpuHand.length)];
    setCpuPlayed(cpu);
    const wins = card.value >= cpu.value || card.suit === trump.suit;
    if (wins) { setScore((s) => s + card.value + cpu.value); playSound("success"); }
    else playSound("navigate");
    setHand(hand.filter((_, i) => i !== idx));
    setTimeout(() => { setPlayed(null); setCpuPlayed(null); }, 1500);
  }, [hand, cpuHand, trump, playSound]);

  const restart = () => { window.location.reload(); };

  return (
    <div className="space-y-4">
      {played && cpuPlayed && (
        <div className="flex justify-center gap-8">
          <Card className="w-24 h-32 flex items-center justify-center text-2xl">{played.suit}{played.value}</Card>
          <span className="self-center text-2xl">⚔️</span>
          <Card className="w-24 h-32 flex items-center justify-center text-2xl">{cpuPlayed.suit}{cpuPlayed.value}</Card>
        </div>
      )}
      {hand.length > 0 ? (
        <Card><CardContent className="pt-6">
          <div className="flex justify-center gap-3">
            {hand.map((card, i) => (
              <Button key={i} variant="outline" className="h-24 w-20 text-xl flex-col" onClick={() => play(i)}>
                <span className="text-2xl">{card.suit}</span><span className="font-bold">{card.value}</span>
              </Button>
            ))}
          </div>
        </CardContent></Card>
      ) : (
        <Card><CardContent className="pt-6 text-center space-y-4">
          <p className="text-5xl">🏆</p>
          <p className="text-2xl font-bold">{t("briscola.finalScore")}: {score}</p>
          <Button size="lg" onClick={restart}>{t("briscola.restart")}</Button>
        </CardContent></Card>
      )}
    </div>
  );
}

// ─── Multiplayer ─────────────────────────────────────────────────────────────
function BriscolaMulti() {
  const { user } = useAuth();
  const { playSound } = useSound();
  const mp  = useMultiplayer("briscola");
  const [resolving, setResolving] = useState(false);

  const gs      = mp.session?.game_state as Record<string, unknown> | null;
  const hands   = (gs?.hands  as Record<string, BCard[]>) ?? {};
  const trump   = (gs?.trump  as BCard | null) ?? null;
  const table   = (gs?.table  as Record<string, BCard | null>) ?? {};
  const scoresG = (gs?.scores as Record<string, number>) ?? {};
  const myHand  = hands[user?.id ?? ""] ?? [];
  const opp     = mp.opponents[0];
  const myTableCard  = table[user?.id ?? ""] ?? null;
  const oppTableCard = table[opp?.id ?? ""] ?? null;

  // Auto-resolve trick when both have played
  useEffect(() => {
    if (!mp.isMyTurn || !opp || !gs) return;
    const myCard  = table[user?.id ?? ""];
    const oppCard = table[opp.id];
    if (!myCard || !oppCard || resolving) return;
    setResolving(true);
    // Determine winner of trick
    const myWins = trump
      ? (myCard.suit === trump.suit && oppCard.suit !== trump.suit) ||
        (myCard.suit === oppCard.suit && myCard.value > oppCard.value)
      : myCard.value >= oppCard.value;
    const trickWinner = myWins ? user!.id : opp.id;
    const newScores   = { ...scoresG, [trickWinner]: (scoresG[trickWinner] ?? 0) + myCard.value + oppCard.value };
    setTimeout(() => {
      const newHands = { ...hands };
      newHands[user!.id] = myHand.filter((c) => c !== myCard);
      const oppHand = (hands[opp.id] ?? []).filter((c) => c !== oppCard);
      newHands[opp.id]   = oppHand;
      const gameOver = newHands[user!.id].length === 0 && newHands[opp.id].length === 0;
      const newTable: Record<string, BCard | null> = { [user!.id]: null, [opp.id]: null };
      if (gameOver) {
        const winnerId = newScores[user!.id] >= newScores[opp.id] ? user!.id : opp.id;
        mp.makeMove({ hands: newHands, trump, table: newTable, scores: newScores }, winnerId);
        mp.endGame(winnerId);
      } else {
        mp.makeMove({ hands: newHands, trump, table: newTable, scores: newScores }, trickWinner);
      }
      setResolving(false);
      playSound(myWins ? "success" : "navigate");
    }, 1200);
  }, [gs, table, mp, user, opp, hands, myHand, trump, scoresG, resolving, playSound]);

  const initState = useCallback(() => {
    const players = mp.session?.players ?? [];
    const deck    = createDeck();
    const h: Record<string, BCard[]> = {};
    players.forEach((p, i) => { h[p.id] = deck.slice(i * 3, i * 3 + 3); });
    const t: Record<string, null> = {};
    players.forEach((p) => { t[p.id] = null; });
    const s: Record<string, number> = {};
    players.forEach((p) => { s[p.id] = 0; });
    return { hands: h, trump: deck[deck.length - 1], table: t, scores: s };
  }, [mp.session?.players]);

  const playCard = useCallback((idx: number) => {
    if (!mp.isMyTurn || !user || myTableCard) return;
    const card     = myHand[idx];
    const newTable = { ...table, [user.id]: card };
    const opp      = mp.opponents[0];
    // If opponent already played → other player's hook resolves the trick
    const next = opp && newTable[opp.id] ? user.id : opp?.id ?? user.id;
    mp.makeMove({ ...(gs ?? {}), table: newTable }, next);
    playSound("success");
  }, [mp, user, myHand, myTableCard, table, gs, playSound]);

  if (mp.status === "idle")
    return <MultiplayerLobby gameType="briscola" loading={mp.loading} onCreateRoom={mp.createRoom} onJoinRoom={mp.joinRoom} />;
  if (mp.status === "waiting")
    return <WaitingRoom session={mp.session!} isHost={mp.isHost} onStart={() => mp.startGame(initState())} onLeave={mp.leaveRoom} />;
  if (mp.status === "finished")
    return <FinishBanner winnerId={mp.session!.winner_id} myId={user?.id ?? ""} players={mp.session!.players.map((p) => ({ ...p, score: scoresG[p.id] ?? 0 }))} onRematch={mp.leaveRoom} />;

  return (
    <div className="space-y-4">
      {trump && <div className="text-center"><Badge variant="secondary">Trump: {trump.suit}{trump.value}</Badge></div>}
      <OpponentPanel opponent={opp ? { ...opp, score: scoresG[opp.id] ?? 0 } : undefined} isOpponentTurn={!mp.isMyTurn}
        extraInfo={oppTableCard ? <Badge variant="outline">{oppTableCard.suit}{oppTableCard.value}</Badge> : <Badge variant="outline">…</Badge>}
      />
      {(myTableCard || oppTableCard) && (
        <div className="flex justify-center gap-8">
          <Card className="w-24 h-32 flex items-center justify-center text-2xl">{myTableCard ? `${myTableCard.suit}${myTableCard.value}` : "?"}</Card>
          <span className="self-center text-2xl">⚔️</span>
          <Card className="w-24 h-32 flex items-center justify-center text-2xl">{oppTableCard ? `${oppTableCard.suit}${oppTableCard.value}` : "?"}</Card>
        </div>
      )}
      <Card className={mp.isMyTurn ? "border-primary" : "opacity-70"}>
        <CardContent className="pt-6 space-y-4">
          <div className="text-center">
            <Badge variant="secondary">Your score: {scoresG[user?.id ?? ""] ?? 0}</Badge>
            <p className="text-sm text-muted-foreground mt-1">
              {myTableCard ? "Card played — waiting…" : mp.isMyTurn ? "Play a card" : "Opponent's turn"}
            </p>
          </div>
          <div className="flex justify-center gap-3">
            {myHand.map((card, i) => (
              <Button key={i} variant="outline" className="h-24 w-20 text-xl flex-col"
                disabled={!mp.isMyTurn || !!myTableCard} onClick={() => playCard(i)}>
                <span className="text-2xl">{card.suit}</span><span className="font-bold">{card.value}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Briscola() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<"solo" | "multi">("solo");

  return (
    <Layout>
      <section className="mx-auto max-w-2xl px-4 py-10">
        <div className="relative mb-6 overflow-hidden rounded-2xl">
          <img src={heroImg} alt="" role="presentation" className="h-40 w-full object-cover sm:h-48" width={800} height={512} loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 text-center">
            <h1 className="text-3xl font-bold">🃏 {t("briscola.title")}</h1>
          </div>
        </div>
        <div className="flex rounded-lg overflow-hidden border mb-6">
          <button onClick={() => setMode("solo")}  className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "solo"  ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>🎮 Solo</button>
          <button onClick={() => setMode("multi")} className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "multi" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>👥 Online</button>
        </div>
        {mode === "solo" ? <BriscolaSolo /> : <BriscolaMulti />}
      </section>
    </Layout>
  );
}
