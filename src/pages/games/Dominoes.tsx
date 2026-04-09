import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useState, useEffect, useCallback } from "react";

type Tile = { left: number; right: number };

function createTiles(): Tile[] {
  const tiles: Tile[] = [];
  for (let i = 0; i <= 6; i++) for (let j = i; j <= 6; j++) tiles.push({ left: i, right: j });
  return tiles;
}

export default function Dominoes() {
  const { t } = useLanguage();
  const { playSound } = useSound();
  const [hand, setHand] = useState<Tile[]>([]);
  const [board, setBoard] = useState<Tile[]>([]);
  const [score, setScore] = useState(0);

  const deal = useCallback(() => {
    const all = createTiles().sort(() => Math.random() - 0.5);
    setHand(all.slice(0, 7));
    setBoard([all[7]]);
    setScore(0);
  }, []);

  useEffect(() => { deal(); }, [deal]);

  const canPlay = (tile: Tile) => {
    if (board.length === 0) return true;
    const left = board[0].left;
    const right = board[board.length - 1].right;
    return tile.left === left || tile.right === left || tile.left === right || tile.right === right;
  };

  const playTile = (idx: number) => {
    const tile = hand[idx];
    if (!canPlay(tile)) { playSound("navigate"); return; }
    const right = board[board.length - 1].right;
    const left = board[0].left;
    const newBoard = [...board];
    if (tile.left === right) newBoard.push(tile);
    else if (tile.right === right) newBoard.push({ left: tile.right, right: tile.left });
    else if (tile.right === left) newBoard.unshift(tile);
    else if (tile.left === left) newBoard.unshift({ left: tile.right, right: tile.left });
    setBoard(newBoard);
    setHand(hand.filter((_, i) => i !== idx));
    setScore((s) => s + tile.left + tile.right);
    playSound("success");
  };

  return (
    <Layout>
      <section className="mx-auto max-w-3xl px-4 py-10">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold">{t("dominoes.title")}</h1>
          <Badge className="mt-2">{t("dominoes.score")}: {score}</Badge>
        </div>
        <Card className="mb-6">
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
                <Button key={i} variant={canPlay(tile) ? "default" : "outline"} className="text-lg font-bold px-4 py-6" onClick={() => playTile(i)}>
                  {tile.left}|{tile.right}
                </Button>
              ))}
            </div>
            {hand.length === 0 && <p className="text-center text-primary font-bold text-xl mt-4">🎉 {t("dominoes.won")}</p>}
            <Button variant="outline" className="w-full mt-4" onClick={deal}>{t("dominoes.restart")}</Button>
          </CardContent>
        </Card>
      </section>
    </Layout>
  );
}
