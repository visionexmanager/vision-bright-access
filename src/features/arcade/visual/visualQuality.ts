import type { ArcadeGame } from "../catalog";
import { visualsForGame } from "./visualRegistry";

export function auditGameVisuals(game: ArcadeGame) {
  const assets = visualsForGame(game);
  const issues = assets.flatMap((asset) => {
    const source = asset.sources[0];
    const result: string[] = [];
    if (asset.quality !== "production") result.push(`${asset.kind}: not a production/Retina asset`);
    const scalableVector = source?.mimeType === "image/svg+xml";
    if (!source || (!scalableVector && source.width < 1600)) result.push(`${asset.kind}: width below 1600px`);
    if (asset.kind === "background" && (!source || (!scalableVector && source.width < 1920))) result.push("background: below Full HD target");
    if (!asset.sources.some((item) => item.mimeType === "image/webp" || item.mimeType === "image/avif" || item.mimeType === "image/svg+xml")) result.push(`${asset.kind}: no modern image format`);
    return result;
  });
  return { gameId:game.slug, status:issues.length ? "redesign-required" as const : "approved" as const, issues };
}
