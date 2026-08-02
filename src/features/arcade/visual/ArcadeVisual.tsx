import type { ImgHTMLAttributes } from "react";
import type { PremiumVisualAsset } from "./types";
import { premiumVisualAssetsManager } from "./PremiumVisualAssetsManager";

export function ArcadeVisual({ asset, className, ...props }: { asset: PremiumVisualAsset } & Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet" | "alt">) {
  const source = premiumVisualAssetsManager.select(asset);
  const srcSet = asset.sources.map((item) => `${item.src} ${item.width}w`).join(", ");
  return <img {...props} src={source.src} srcSet={srcSet || undefined} sizes={props.sizes ?? "(max-width: 640px) 100vw, 33vw"} alt={asset.alt} className={className} decoding="async" style={{ objectPosition:asset.focalPoint, ...props.style }} />;
}
