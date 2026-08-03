import type { ArcadeGame } from "../catalog";
import type { PremiumVisualAsset } from "./types";

export function visualsForGame(game: ArcadeGame): readonly PremiumVisualAsset[] {
  const isVector = game.image.endsWith(".svg");
  const [width, height] = game.slug === "visionopoly" ? [1600,900] : [1920,1080];
  const mimeType = isVector ? "image/svg+xml" as const : "image/webp" as const;
  const source = { src:game.image, width, height, mimeType };
  const quality = "production" as const;
  return [
    { id:`${game.slug}-cover`, gameId:game.slug, kind:"cover", alt:`${game.title} game cover`, focalPoint:"50% 50%", quality, sources:[source] },
    { id:`${game.slug}-thumbnail`, gameId:game.slug, kind:"thumbnail", alt:"", focalPoint:"50% 50%", quality, sources:[source] },
    { id:`${game.slug}-background`, gameId:game.slug, kind:"background", alt:"", focalPoint:"50% 50%", quality, sources:[source] },
  ];
}

export function visualForGame(game: ArcadeGame, kind: PremiumVisualAsset["kind"]) {
  return visualsForGame(game).find((asset) => asset.kind === kind)!;
}
