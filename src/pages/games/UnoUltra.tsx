import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useState, useCallback } from "react";
import heroImg from "@/assets/game-uno.jpg";
import { useMultiplayer } from "@/hooks/useMultiplayer";
import { MultiplayerLobby } from "@/components/multiplayer/MultiplayerLobby";
import { WaitingRoom } from "@/components/multiplayer/WaitingRoom";
import { OpponentPanel, FinishBanner } from "@/components/multiplayer/OpponentPanel";
import { useAuth } from "@/contexts/AuthContext";

const COLORS    = ["🔴", "🟡", "🟢", "🔵"];
const UNO_CARDS = COLORS.flatMap((c) => Array.from({ length: 5 }, (_, i) => ({ color: c, value: i + 1 })));
type UCard = { color: string; value: number };

function canPlay(card: UCard, pile: UCard) { return card.color === pile.color || card.value === pile.value; }
function randomCard() { return UNO_CARDS[Math.floor(Math.random() * UNO_CARDS.length)]; }

// ─── Solo ────────────────────────────────────────────────────────────────────
function UnoSolo() {
  const { t } = useLanguage();
  const { playSound } = useSound();
  const [deck, setDeck] = useState(() => [...UNO_CARDS].sort(() => Math.random() - 0.5));
  const [hand, setHand] = useState<UCard[]>(() => deck.slice(0, 7));
  const [pile, setPile] = useState<UCard>(() => deck[7]);
  const [score, setScore] = useState(0);

  const playCard = useCallback((idx: number) => {
    const card = hand[idx];
    if (!canPlay(card, pile)) { playSound("navigate"); return; }
    setPile(card);
    const h = hand.filter((_, i) => i !== idx);
    setHand(h); setScore((s) => s + card.value * 10); playSound("success");
  }, [hand, pile, playSound]);

  const draw = () => { setHand([...hand, randomCard()]); playSound("navigate"); };
  const restart = () => {
    const d = [...UNO_CARDS].sort(() => Math.random() - 0.5);
    setDeck(d); setHand(d.slice(0, 7)); setPile(d[7]); setScore(0); playSound("start");
  };

  return (
    <div className="space-y-4">
      <Card><CardContent className="pt-6 text-center">
        <p className="text-sm text-muted-foreground mb-2">{t("uno.currentCard")}:</p>
        <div className="text-5xl font-bold">{pile.color} {pile.value}</div>
      </CardContent></Card>
      {hand.length === 0 ? (
        <Card><CardContent className="pt-6 text-center space-y-4">
          <p className="text-5xl">🏆</p><p className="text-2xl font-bold">{t("uno.won")}</p>
          <Button size="lg" onClick={restart}>{t("uno.restart")}</Button>
        </CardContent></Card>
      ) : (
        <Card><CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap justify-center gap-2">
            {hand.map((card, i) => (
              <Button key={i} variant={canPlay(card, pile) ? "default" : "outline"} className="text-lg h-16 w-16 flex-col" onClick={() => playCard(i)}>
                <span>{card.color}</span><span className="text-sm font-bold">{card.value}</span>
              </Button>
            ))}
          </div>
          <div className="flex justify-center gap-3">
            <Button variant="secondary" onClick={draw}>{t("uno.draw")}</Button>
            <Button variant="outline" onClick={restart}>{t("uno.restart")}</Button>
          </div>
        </CardContent></Card>
      )}
    </div>
  );
}

// ─── Multiplayer ─────────────────────────────────────────────────────────────
function UnoMulti() {
  const { user } = useAuth();
  const { playSound } = useSound();
  const mp = useMultiplayer("uno");

  const gs     = mp.session?.game_state as Record<string, unknown> | null;
  const hands  = (gs?.hands as Record<string, UCard[]>) ?? {};
  const pile   = (gs?.pile  as UCard) ?? UNO_CARDS[0];
  const myHand = hands[user?.id ?? ""] ?? [];
  const opp    = mp.opponents[0];
  const oppHandCount = (hands[opp?.id ?? ""] ?? []).length;

  const nextPlayer = () => mp.session?.players.find((p) => p.id !== user?.id)?.id ?? user?.id ?? "";

  const initState = useCallback(() => {
    const players = mp.session?.players ?? [];
    const deck    = [...UNO_CARDS].sort(() => Math.random() - 0.5);
    const h: Record<string, UCard[]> = {};
    players.forEach((p, i) => { h[p.id] = deck.slice(i * 7, i * 7 + 7); });
    return { hands: h, pile: deck[14] };
  }, [mp.session?.players]);

  const playCard = useCallback((idx: number) => {
    if (!mp.isMyTurn || !user) return;
    const card = myHand[idx];
    if (!canPlay(card, pile)) { playSound("navigate"); return; }
    const newHands = { ...hands, [user.id]: myHand.filter((_, i) => i !== idx) };
    if (newHands[user.id].length === 0) {
      mp.makeMove({ hands: newHands, pile: card }, nextPlayer());
      mp.endGame(user.id);
      playSound("success");
      return;
    }
    mp.makeMove({ hands: newHands, pile: card }, nextPlayer());
    playSound("success");
  }, [mp, user, myHand, pile, hands, playSound]);

  const draw = useCallback(() => {
    if (!mp.isMyTurn || !user) return;
    const newCard  = randomCard();
    const newHands = { ...hands, [user.id]: [...myHand, newCard] };
    mp.makeMove({ hands: newHands, pile }, nextPlayer());
    playSound("navigate");
  }, [mp, user, myHand, hands, pile, playSound]);

  if (mp.status === "idle")
    return <MultiplayerLobby gameType="uno" loading={mp.loading} onCreateRoom={mp.createRoom} onJoinRoom={mp.joinRoom} />;
  if (mp.status === "waiting")
    return <WaitingRoom session={mp.session!} isHost={mp.isHost} onStart={() => mp.startGame(initState())} onLeave={mp.leaveRoom} />;
  if (mp.status === "finished")
    return <FinishBanner winnerId={mp.session!.winner_id} myId={user?.id ?? ""} players={mp.session!.players} onRematch={mp.leaveRoom} />;

  return (
    <div className="space-y-4">
      <OpponentPanel opponent={opp} isOpponentTurn={!mp.isMyTurn} label={`Cards in hand: ${oppHandCount}`} />
      <Card><CardContent className="pt-6 text-center">
        <p className="text-sm text-muted-foreground mb-2">Current card:</p>
        <div className="text-5xl font-bold">{pile.color} {pile.value}</div>
      </CardContent></Card>
      <Card className={mp.isMyTurn ? "border-primary" : "opacity-70"}>
        <CardContent className="pt-6 space-y-4">
          <p className="text-center text-sm font-medium">
            {mp.isMyTurn ? `Your turn — ${myHand.length} card(s)` : "Opponent's turn…"}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {myHand.map((card, i) => (
              <Button key={i} variant={canPlay(card, pile) ? "default" : "outline"} disabled={!mp.isMyTurn}
                className="text-lg h-16 w-16 flex-col" onClick={() => playCard(i)}>
                <span>{card.color}</span><span className="text-sm font-bold">{card.value}</span>
              </Button>
            ))}
          </div>
          <div className="flex justify-center">
            <Button variant="secondary" disabled={!mp.isMyTurn} onClick={draw}>Draw card</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function UnoUltra() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<"solo" | "multi">("solo");

  return (
    <Layout>
      <section className="mx-auto max-w-2xl px-4 py-10">
        <div className="relative mb-6 overflow-hidden rounded-2xl">
          <img src={heroImg} alt="" role="presentation" className="h-40 w-full object-cover sm:h-48" width={800} height={512} loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 text-center">
            <h1 className="text-3xl font-bold">🃏 {t("uno.title")}</h1>
          </div>
        </div>
        <div className="flex rounded-lg overflow-hidden border mb-6">
          <button onClick={() => setMode("solo")}  className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "solo"  ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>🎮 Solo</button>
          <button onClick={() => setMode("multi")} className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "multi" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>👥 Online</button>
        </div>
        {mode === "solo" ? <UnoSolo /> : <UnoMulti />}
      </section>
    </Layout>
  );
}
