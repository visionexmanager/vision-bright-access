import { advancedAudioEngine, type AdvancedAudioEngine } from "./AdvancedAudioEngine";
import type { MusicState } from "./types";

const MUSIC_ASSETS: Partial<Record<MusicState, string>> = {
  menu:"music-menu", calm:"music-menu", active:"music-active", danger:"music-danger", victory:"natural-victory", failure:"natural-failure",
};

export class DynamicMusicController {
  private current?: string;
  constructor(private engine: AdvancedAudioEngine = advancedAudioEngine) {}

  async transition(state: MusicState) {
    const next = MUSIC_ASSETS[state];
    if (!next || next === this.current) return;
    if (this.current) this.engine.stop(this.current, 0.8);
    this.current = next;
    await this.engine.play(next, { loop:["menu","calm","active","danger"].includes(state), volume:1 });
  }

  stop() { if (this.current) this.engine.stop(this.current, 0.5); this.current = undefined; }
}

export const dynamicMusic = new DynamicMusicController();
