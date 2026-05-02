import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useState, useEffect, useCallback } from "react";
import heroImg from "@/assets/game-dominoes.jpg";
import { useMultiplayer } from "@/hooks/useMultiplayer";
import { MultiplayerLobby } from "@/components/multiplayer/MultiplayerLobby";
import { WaitingRoom } from "@/components/multiplayer/WaitingRoom";
import { OpponentPanel, FinishBanner } from "@/components/multiplayer/OpponentPanel";
import { useAuth } from "@/contexts/AuthContext";

type Tile = { left: number; right: number };

function createTiles(): Tile[] {
  const t: Tile[] = [];
  for (let i = 0; i <= 6; i++) for (let j = i; j <= 6; j++) t.push({ left: i, right: j });
  return t;
}

function canPlay(tile: Tile, board: Tile[]) {
  if (!board.length) return true;
  const l = board[0].left, r = board[board.length - 1].right;
  return tile.left === l || tile.right === l || tile.left === r || tile.right === r;
}

function place(tile: Tile, board: Tile[]): Tile[] {
  const r = board[board.length - 1].right, l = board[0].left;
  const nb = [...board];
  if (tile.left === r) nb.push(tile);
  else if (tile.right === r) nb.push({ left: tile.right, right: tile.left });
  else if (tile.right === l) nb.unshift(tile);
  else nb.unshift({ left: tile.right, right: tile.left });
  return nb;
}

// ─── Solo ────────────────────────────────────────────────────────────────────
function DominoesSolo() {
  const { t } = useLanguage();
  const { playSound } = useSound();
  const [hand,  setHand]  = useState<Tile[]>([]);
  const [board, setBoard] = useState<Tile[]>([]);
  const [score, setScore] = useState(0);

  const deal = useCallback(() => {
    const all = createTiles().sort(() => Math.random() - 0.5);
    setHand(all.slice(0, 7)); setBoard([all[7]]); setScore(0);
  }, []);

  useEffect(() => { deal(); }, [deal]);

  const playTile = (idx: number) => {
    const tile = hand[idx];
    if (!canPlay(tile, board)) { playSound("navigate"); return; }
    setBoard(place(tile, board));
    setHand(hand.filter((_, i) => i !== idx));
    setScore((s) => s + tile.left + tile.right);
    playSound("success");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>{t("dominoes.board")}</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 justify-center min-h-[60px]">
            {board.map((tile, i) => (
              <div key={i} className="inline-flex items-center gap-0 border-2 border-border rounded-lg px-3 py-2 bg-accent text-lg font-bold">
                {tile.left}<span className="mx-1 text-muted-foreground">|</span>{tile.right}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{t("dominoes.yourHand")}</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 justify-center">
            {hand.map((tile, i) => (
              <Button key={i} variant={canPlay(tile, board) ? "default" : "outline"} className="text-lg font-bold px-4 py-6" onClick={() => playTile(i)}>
                {tile.left}|{tile.right}
              </Button>
            ))}
          </div>
          {hand.length === 0 && <p className="text-center text-primary font-bold text-xl mt-4">🎉 {t("dominoes.won")}</p>}
          <Button variant="outline" className="w-full mt-4" onClick={deal}>{t("dominoes.restart")}</Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Multiplayer ─────────────────────────────────────────────────────────────
function DominoesMulti() {
  const { user } = useAuth();
  const { playSound } = useSound();
  const mp = useMultiplayer("dominoes");

  const gs    = mp.session?.game_state as Record<string, unknown> | null;
  const hands = (gs?.hands  as Record<string, Tile[]>) ?? {};
  const board = (gs?.board  as Tile[]) ?? [];
  const scoresG = (gs?.scores as Record<string, number>) ?? {};
  const myHand  = hands[user?.id ?? ""] ?? [];
  const opp     = mp.opponents[0];
  const oppHandCount = (hands[opp?.id ?? ""] ?? []).length;

  const nextPlayer = () => mp.session?.players.find((p) => p.id !== user?.id)?.id ?? user?.id ?? "";

  const initState = useCallback(() => {
    const players = mp.session?.players ?? [];
    const all = createTiles().sort(() => Math.random() - 0.5);
    const h: Record<string, Tile[]> = {};
    players.forEach((p, i) => { h[p.id] = all.slice(i * 7, i * 7 + 7); });
    const s: Record<string, number> = {};
    players.forEach((p) => { s[p.id] = 0; });
    return { hands: h, board: [all[14]], scores: s };
  }, [mp.session?.players]);

  const playTile = useCallback((idx: number) => {
    if (!mp.isMyTurn || !user) return;
    const tile = myHand[idx];
    if (!canPlay(tile, board)) { playSound("navigate"); return; }
    const newBoard  = place(tile, board);
    const newHands  = { ...hands, [user.id]: myHand.filter((_, i) => i !== idx) };
    const newScores = { ...scoresG, [user.id]: (scoresG[user.id] ?? 0) + tile.left + tile.right };
    if (newHands[user.id].length === 0) {
      mp.makeMove({ hands: newHands, board: newBoard, scores: newScores }, nextPlayer());
      mp.endGame(user.id);
      playSound("success");
      return;
    }
    mp.makeMove({ hands: newHands, board: newBoard, scores: newScores }, nextPlayer());
    playSound("success");
  }, [mp, user, myHand, board, hands, scoresG, playSound]);

  // Pass (no playable tile) — just switch turns
  const pass = useCallback(() => {
    if (!mp.isMyTurn) return;
    mp.makeMove(gs ?? {}, nextPlayer());
    playSound("navigate");
  }, [mp, gs, playSound]);

  const hasPlayable = myHand.some((t) => canPlay(t, board));

  if (mp.status === "idle")
    return <MultiplayerLobby gameType="dominoes" loading={mp.loading} onCreateRoom={mp.createRoom} onJoinRoom={mp.joinRoom} />;
  if (mp.status === "waiting")
    return <WaitingRoom session={mp.session!} isHost={mp.isHost} onStart={() => mp.startGame(initState())} onLeave={mp.leaveRoom} />;
  if (mp.status === "finished")
    return <FinishBanner winnerId={mp.session!.winner_id} myId={user?.id ?? ""} players={mp.session!.players.map((p) => ({ ...p, score: scoresG[p.id] ?? 0 }))} onRematch={mp.leaveRoom} />;

  return (
    <div className="space-y-4">
      <OpponentPanel opponent={opp ? { ...opp, score: scoresG[opp.id] ?? 0 } : undefined} isOpponentTurn={!mp.isMyTurn}
        label={`Tiles in hand: ${oppHandCount}`} />
      <Card>
        <CardHeader><CardTitle>Board</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 justify-center min-h-[60px]">
            {board.map((tile, i) => (
              <div key={i} className="inline-flex items-center border-2 border-border rounded-lg px-3 py-2 bg-accent text-lg font-bold">
                {tile.left}<span className="mx-1 text-muted-foreground">|</span>{tile.right}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card className={mp.isMyTurn ? "border-primary" : "opacity-70"}>
        <CardHeader>
          <CardTitle className="text-sm">
            Your hand ({myHand.length} tiles) — {mp.isMyTurn ? "your turn" : "waiting…"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 justify-center">
            {myHand.map((tile, i) => (
              <Button key={i} variant={canPlay(tile, board) ? "default" : "outline"}
                className="text-lg font-bold px-4 py-6" disabled={!mp.isMyTurn} onClick={() => playTile(i)}>
                {tile.left}|{tile.right}
              </Button>
            ))}
          </div>
          {mp.isMyTurn && !hasPlayable && (
            <Button variant="secondary" className="w-full" onClick={pass}>Pass turn</Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Dominoes() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<"solo" | "multi">("solo");

  return (
    <Layout>
      <section className="mx-auto max-w-3xl px-4 py-10">
        <div className="relative mb-6 overflow-hidden rounded-2xl">
          <img src={heroImg} alt="" role="presentation" className="h-40 w-full object-cover sm:h-48" width={800} height={512} loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 text-center">
            <h1 className="text-3xl font-bold">{t("dominoes.title")}</h1>
            <Badge className="mt-2">{t("dominoes.score")}: 0</Badge>
          </div>
        </div>
        <div className="flex rounded-lg overflow-hidden border mb-6">
          <button onClick={() => setMode("solo")}  className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "solo"  ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>🎮 Solo</button>
          <button onClick={() => setMode("multi")} className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "multi" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>👥 Online</button>
        </div>
        {mode === "solo" ? <DominoesSolo /> : <DominoesMulti />}
      </section>
    </Layout>
  );
}
