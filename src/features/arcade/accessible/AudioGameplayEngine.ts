import { advancedAudioEngine } from "../audio/AdvancedAudioEngine";
import { audioLibrary } from "../audio/audioLibrary";
import type { Direction, AccessibleGameplayEvent, AccessibleGameplayEventType } from "./types";

const positions: Record<Direction, { x:number; y:number; z:number }> = {
  front:{ x:0,y:0,z:-2 }, behind:{ x:0,y:0,z:2 }, left:{ x:-2,y:0,z:0 }, right:{ x:2,y:0,z:0 }, near:{ x:0,y:0,z:-.6 }, far:{ x:0,y:0,z:-8 },
};

export class AudioGameplayEngine extends EventTarget {
  emit(type: AccessibleGameplayEventType, message: string, gameId?: string) {
    if (!message.trim()) return;
    const detail: AccessibleGameplayEvent = { type, message, gameId, priority:["failure","warning","instruction"].includes(type) ? "assertive" : "polite" };
    this.dispatchEvent(new CustomEvent("gameplay", { detail }));
    window.dispatchEvent(new CustomEvent("visionex:accessible-gameplay", { detail }));
  }

  instruct(message:string, gameId?:string) { this.emit("instruction", message, gameId); }
  status(message:string, gameId?:string) { this.emit("status", message, gameId); }
  remaining(points:number, gameId?:string) { this.emit("score", `${points} points remaining to reach the target.`, gameId); }

  async direction(direction: Direction, message = `The item is ${direction}.`, assetId?: string, gameId?:string) {
    this.emit("position", message, gameId);
    if (!assetId || !audioLibrary.playable().some((asset) => asset.id === assetId)) return false;
    await advancedAudioEngine.play(assetId, { position:positions[direction] });
    return true;
  }
}

export const audioGameplayEngine = new AudioGameplayEngine();
