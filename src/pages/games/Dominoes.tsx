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
import { useState, useEffect, useCallback } from "react";
import heroImg from "@/assets/game-dominoes.jpg";
import { useMultiplayer } from "@/hooks/useMultiplayer";
import { MultiplayerLobby } from "@/components/multiplayer/MultiplayerLobby";
import { WaitingRoom } from "@/components/multiplayer/WaitingRoom";
import { OpponentPanel, FinishBanner } from "@/components/multiplayer/OpponentPanel";
import { useAuth } from "@/contexts/AuthContext";
import { useGameEconomy } from "@/components/game/GameEconomyGate";

type Tile = { left: number; right: number };

// ─── Pip layout per face value ────────────────────────────────────────────────
// Each pip is [cx%, cy%] relative to a 40×40 face
const PIP_POSITIONS: Record<number, [number, number][]> = {
  0: [],
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 22], [75, 22], [25, 50], [75, 50], [25, 78], [75, 78]],
};

function DominoFace({ value, size = 38 }: { value: number; size?: number }) {
  const pips = PIP_POSITIONS[value] ?? [];
  const r = size * 0.09;
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-label={`face ${value}`}>
      {pips.map(([cx, cy], i) => (
        <circle key={i} cx={cx * 0.4} cy={cy * 0.4} r={r} fill="currentColor" />
      ))}
    </svg>
  );
}

function DominoTile({
  tile,
  playable,
  onClick,
  small = false,
}: {
  tile: Tile;
  playable?: boolean;
  onClick?: () => void;
  small?: boolean;
}) {
  const faceSize = small ? 28 : 36;
  const base =
    "inline-flex items-center border-2 rounded-lg bg-card text-foreground transition-all duration-200 select-none";
  const interactive = onClick
    ? playable
      ? "cursor-pointer border-primary hover:shadow-[0_0_10px_2px] hover:shadow-primary/40 hover:scale-105 active:scale-95"
      : "cursor-not-allowed border-border opacity-50"
    : "cursor-default border-border";

  return (
    <button
      onClick={onClick}
      disabled={!onClick || !playable}
      className={`${base} ${interactive} ${small ? "px-2 py-1 gap-1" : "px-3 py-2 gap-2"}`}
      aria-label={`Domino ${tile.left}|${tile.right}`}
    >
      <DominoFace value={tile.left} size={faceSize} />
      <span className="w-px self-stretch bg-border" />
      <DominoFace value={tile.right} size={faceSize} />
    </button>
  );
}

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
  const { dominoThud, dominoInvalid, dominoSlide } = useGameSounds();
  const { settleGameResult } = useGameEconomy();
  const [hand,  setHand]  = useState<Tile[]>([]);
  const [board, setBoard] = useState<Tile[]>([]);
  const [score, setScore] = useState(0);

  const deal = useCallback(() => {
    const all = createTiles().sort(() => Math.random() - 0.5);
    setHand(all.slice(0, 7)); setBoard([all[7]]); setScore(0); dominoSlide();
  }, []);

  useEffect(() => { deal(); }, [deal]);

  const playTile = (idx: number) => {
    const tile = hand[idx];
    if (!canPlay(tile, board)) { dominoInvalid(); return; }
    setBoard(place(tile, board));
    const nextHand = hand.filter((_, i) => i !== idx);
    setHand(nextHand);
    setScore((s) => s + tile.left + tile.right);
    if (nextHand.length === 0) void settleGameResult("win", "Dominoes");
    dominoThud();
  };

  return (
    <div className="space-y-4">
      {/* Board */}
      <Card>
        <CardHeader><CardTitle className="text-sm text-muted-foreground">{t("dominoes.board")}</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto pb-2">
            <div className="flex flex-nowrap gap-1.5 justify-start min-h-[64px] min-w-max px-1">
              {board.map((tile, i) => (
                <DominoTile key={i} tile={tile} small />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Score */}
      <div className="flex justify-center">
        <Badge variant="secondary">⭐ {t("dominoes.score")}: {score}</Badge>
      </div>

      {/* Hand */}
      <Card>
        <CardHeader><CardTitle className="text-sm text-muted-foreground">{t("dominoes.yourHand")} ({hand.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 justify-center">
            {hand.map((tile, i) => (
              <DominoTile key={i} tile={tile} playable={canPlay(tile, board)} onClick={() => playTile(i)} />
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
  const { dominoThud, dominoInvalid } = useGameSounds();
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
    if (!canPlay(tile, board)) { dominoInvalid(); return; }
    const newBoard  = place(tile, board);
    const newHands  = { ...hands, [user.id]: myHand.filter((_, i) => i !== idx) };
    const newScores = { ...scoresG, [user.id]: (scoresG[user.id] ?? 0) + tile.left + tile.right };
    if (newHands[user.id].length === 0) {
      mp.makeMove({ hands: newHands, board: newBoard, scores: newScores }, nextPlayer());
      mp.endGame(user.id);
      dominoThud();
      return;
    }
    mp.makeMove({ hands: newHands, board: newBoard, scores: newScores }, nextPlayer());
    dominoThud();
  }, [mp, user, myHand, board, hands, scoresG, playSound]);

  // Pass (no playable tile) — just switch turns
  const pass = useCallback(() => {
    if (!mp.isMyTurn) return;
    mp.makeMove(gs ?? {}, nextPlayer());
    dominoInvalid();
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
        <CardHeader><CardTitle className="text-sm text-muted-foreground">Board</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto pb-2">
            <div className="flex flex-nowrap gap-1.5 min-w-max px-1 min-h-[56px]">
              {board.map((tile, i) => (
                <DominoTile key={i} tile={tile} small />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className={mp.isMyTurn ? "border-primary shadow-[0_0_12px_2px] shadow-primary/20" : "opacity-70"}>
        <CardHeader>
          <CardTitle className="text-sm">
            Your hand ({myHand.length}) — {mp.isMyTurn ? <span className="text-primary">your turn</span> : "waiting…"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 justify-center">
            {myHand.map((tile, i) => (
              <DominoTile key={i} tile={tile} playable={mp.isMyTurn && canPlay(tile, board)} onClick={mp.isMyTurn ? () => playTile(i) : undefined} />
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
          <div className="absolute bottom-4 start-4 end-4 text-center">
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
