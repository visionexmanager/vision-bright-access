import type { ImgHTMLAttributes } from "react";
import type { PremiumVisualAsset } from "./types";
import { premiumVisualAssetsManager } from "./PremiumVisualAssetsManager";

export function ArcadeVisual({ asset, className, fetchPriority, ...props }: { asset: PremiumVisualAsset } & Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet" | "alt">) {
  const source = premiumVisualAssetsManager.select(asset);
  const srcSet = asset.sources.map((item) => `${item.src} ${item.width}w`).join(", ");
  // React 18 does not know the camelCase `fetchPriority` prop: it logs a
  // warning and drops the attribute, so the priority hint never reached the
  // browser. Emitting the lowercase HTML attribute delivers the hint and
  // clears the console error that appeared on every Arcade page.
  const priority = fetchPriority ? { fetchpriority: fetchPriority } : {};
  return <img {...props} {...priority} src={source.src} srcSet={srcSet || undefined} sizes={props.sizes ?? "(max-width: 640px) 100vw, 33vw"} alt={asset.alt} className={className} decoding="async" style={{ objectPosition:asset.focalPoint, ...props.style }} />;
}
