import { useEffect, useState } from "react";
import { getChildProgressSnapshot } from "./childProgress";

export function useChildProgress() {
  const [progress, setProgress] = useState(getChildProgressSnapshot);
  useEffect(() => {
    const refresh = () => setProgress(getChildProgressSnapshot());
    window.addEventListener("visionex:arcade-player-data", refresh);
    return () => window.removeEventListener("visionex:arcade-player-data", refresh);
  }, []);
  return progress;
}
