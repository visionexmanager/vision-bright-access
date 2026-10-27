import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const played = vi.hoisted(() => vi.fn());
vi.mock("@/features/arcade/audio/playProductionSound", () => ({ playProductionSound: played }));

import { useGameSounds } from "./useGameSounds";

describe("recorded game sounds", () => {
  beforeEach(() => {
    played.mockReset();
    played.mockResolvedValue(true);
  });

  it("plays the shared recordings by registry id", () => {
    const { result } = renderHook(() => useGameSounds());
    result.current.cardFlip();
    result.current.cardShuffle();
    result.current.answerCorrect();
    result.current.answerWrong();
    result.current.keyClick();
    result.current.pencilWrite();
    result.current.drumHit();
    result.current.metronomeClick();
    result.current.tradeCoin();
    expect(played.mock.calls.map(([id]) => id)).toEqual([
      "card-flip", "card-shuffle", "answer-correct", "answer-wrong", "key-click",
      "pencil-write", "drum-hit", "metronome-click", "coin-pickup",
    ]);
  });

  it("re-pitches the E4 piano recording to the note asked for", () => {
    const { result } = renderHook(() => useGameSounds());
    result.current.musicNote(64);
    result.current.musicNote(76);
    expect(played).toHaveBeenNthCalledWith(1, "piano-note", expect.objectContaining({ playbackRate: 1 }));
    expect(played).toHaveBeenNthCalledWith(2, "piano-note", expect.objectContaining({ playbackRate: 2 }));
  });

  it("leaves notes more than an octave away to the synthesised tone", () => {
    const { result } = renderHook(() => useGameSounds());
    result.current.musicNote(30);
    result.current.musicNote(100);
    expect(played).not.toHaveBeenCalled();
  });

  it("does not throw when the recording is refused", async () => {
    played.mockResolvedValue(false);
    const { result } = renderHook(() => useGameSounds());
    expect(() => result.current.cardFlip()).not.toThrow();
    await Promise.resolve();
    expect(played).toHaveBeenCalledTimes(1);
  });
});
