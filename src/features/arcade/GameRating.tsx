import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { playerGameData } from "./core/playerGameData";

export function GameRating({ gameId }: { gameId: string }) {
  const [rating, setRating] = useState(() => playerGameData.get(gameId).rating ?? 0);
  useEffect(() => setRating(playerGameData.get(gameId).rating ?? 0), [gameId]);
  const choose = (value: number) => { const data = playerGameData.get(gameId); playerGameData.save({ ...data, rating:value }); setRating(value); };
  return <div><p className="text-sm font-semibold text-white">Rate this game</p><div className="mt-2 flex gap-1" role="radiogroup" aria-label="Rate this game from 1 to 5 stars">{[1,2,3,4,5].map((value) => <Button key={value} type="button" size="icon" variant="ghost" role="radio" aria-checked={rating === value} aria-label={`${value} star${value === 1 ? "" : "s"}`} onClick={() => choose(value)} className="h-9 w-9 text-amber-300 hover:bg-amber-300/10 hover:text-amber-200"><Star className={`h-5 w-5 ${value <= rating ? "fill-current" : ""}`} /></Button>)}</div><p className="mt-1 text-xs text-slate-400">{rating ? `Your rating: ${rating}/5` : "Not rated yet"} · Cloud ratings connect after schema verification.</p></div>;
}
