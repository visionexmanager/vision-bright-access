import { gameAnalytics } from "../core/gameAnalytics";
import { resolveGraphicsProfile } from "./graphicsQuality";
import type { PremiumVisualAsset, VisualSource } from "./types";
import type { GameAsset } from "../core/types";

export class PremiumVisualAssetsManager {
  private loaded = new Set<string>();
  private pending = new Map<string, Promise<string>>();

  private normalize(asset: PremiumVisualAsset | GameAsset): PremiumVisualAsset {
    if ("sources" in asset) return asset;
    return { id:asset.id, gameId:asset.id.split("-cover")[0], kind:asset.kind, alt:"", quality:"legacy", sources:[{ src:asset.src, width:asset.width ?? 800, height:asset.height ?? 512, mimeType:(asset.mimeType as VisualSource["mimeType"]) ?? "image/jpeg" }] };
  }

  select(input: PremiumVisualAsset | GameAsset): VisualSource {
    const asset = this.normalize(input);
    const profile = resolveGraphicsProfile();
    const target = Math.min(profile.maxAssetWidth, Math.ceil(window.innerWidth * window.devicePixelRatio));
    const source = [...asset.sources].sort((a, b) => a.width - b.width).find((item) => item.width >= target)
      ?? [...asset.sources].sort((a, b) => b.width - a.width)[0];
    if (!source) throw new Error(`No visual source registered for ${asset.id}`);
    return source;
  }

  load(input: PremiumVisualAsset | GameAsset) {
    const asset = this.normalize(input);
    const source = this.select(asset);
    if (!source) return Promise.reject(new Error(`No visual source registered for ${asset.id}`));
    if (this.loaded.has(source.src)) return Promise.resolve(source.src);
    const active = this.pending.get(source.src);
    if (active) return active;
    const promise = new Promise<string>((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = async () => {
        try { await image.decode(); } catch { /* load event is sufficient */ }
        this.loaded.add(source.src); this.pending.delete(source.src); resolve(source.src);
      };
      image.onerror = () => {
        this.pending.delete(source.src);
        gameAnalytics.track("asset_error", { gameId:asset.gameId });
        reject(new Error(`Unable to load visual asset: ${asset.id}`));
      };
      image.src = source.src;
    });
    this.pending.set(source.src, promise);
    return promise;
  }

  preload(assets: readonly (PremiumVisualAsset | GameAsset)[]) { return Promise.allSettled(assets.map((asset) => this.load(asset))); }
  isLoaded(src: string) { return this.loaded.has(src); }
  clear() { this.loaded.clear(); this.pending.clear(); }
}

export const premiumVisualAssetsManager = new PremiumVisualAssetsManager();
