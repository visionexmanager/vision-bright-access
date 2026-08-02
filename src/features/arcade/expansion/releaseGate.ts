import { audioLibrary } from "../audio/audioLibrary";
import type { PlannedArcadeGame } from "./types";

export function evaluateNewGameRelease(game: PlannedArcadeGame) {
  const failures: string[] = [];
  for (const [gate, status] of Object.entries(game.gates)) if (status !== "approved") failures.push(`${gate} is ${status}`);
  if (!audioLibrary.forGame(game.id).some((asset) => asset.quality === "production" && asset.licenseStatus === "approved" && asset.sources.length)) failures.push("no approved production audio");
  return { approved:failures.length === 0, failures };
}
