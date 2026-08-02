import { useEffect, useState } from "react";
import { playerGameData } from "./playerGameData";

export function usePlayerGameData(gameId: string) {
  const [data, setData] = useState(() => playerGameData.get(gameId));
  useEffect(() => {
    setData(playerGameData.get(gameId));
    const refresh = () => setData(playerGameData.get(gameId));
    window.addEventListener("visionex:arcade-player-data", refresh);
    return () => window.removeEventListener("visionex:arcade-player-data", refresh);
  }, [gameId]);
  return data;
}
