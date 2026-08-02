import { describe, expect, it, vi } from "vitest";
import { AudioGameplayEngine } from "./AudioGameplayEngine";

describe("Audio Gameplay Engine", () => {
  it("publishes semantic gameplay descriptions for screen readers", () => {
    const engine = new AudioGameplayEngine(); const listener = vi.fn();
    window.addEventListener("visionex:accessible-gameplay", listener, { once:true });
    engine.instruct("Move right", "audio-adventure");
    expect(listener).toHaveBeenCalledOnce();
    const detail = (listener.mock.calls[0][0] as CustomEvent).detail;
    expect(detail).toMatchObject({ message:"Move right", priority:"assertive", gameId:"audio-adventure" });
  });

  it("announces direction but refuses unapproved spatial audio", async () => {
    const engine = new AudioGameplayEngine();
    await expect(engine.direction("right", "The item is to your right.", "dice-roll")).resolves.toBe(false);
  });
});
