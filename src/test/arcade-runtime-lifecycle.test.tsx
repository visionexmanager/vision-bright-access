import { act, cleanup, render, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { gameManager } from "@/features/arcade/core/gameManager";
import { useArcadeGameLoop, useArcadePaused } from "@/features/arcade/core/useArcadeRuntime";

afterEach(() => {
  cleanup();
  gameManager.stop();
  vi.useRealTimers();
});

describe("arcade runtime lifecycle", () => {
  it("reports the shell pause state to the game", () => {
    act(() => { gameManager.start("snake"); });
    const { result } = renderHook(() => useArcadePaused());

    expect(result.current).toBe(false);
    act(() => { gameManager.pause(); });
    expect(result.current).toBe(true);
    act(() => { gameManager.resume(); });
    expect(result.current).toBe(false);
  });

  it("stops the shared game loop while the session is paused", () => {
    vi.useFakeTimers();
    const tick = vi.fn();
    act(() => { gameManager.start("snake"); });
    renderHook(() => useArcadeGameLoop(tick, 100));

    act(() => { vi.advanceTimersByTime(300); });
    expect(tick).toHaveBeenCalledTimes(3);

    act(() => { gameManager.pause(); });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(tick, "a paused game must not keep ticking behind the overlay").toHaveBeenCalledTimes(3);

    act(() => { gameManager.resume(); });
    act(() => { vi.advanceTimersByTime(200); });
    expect(tick).toHaveBeenCalledTimes(5);
  });

  it("clears the loop on unmount so a leaving game leaves no timer behind", () => {
    vi.useFakeTimers();
    const tick = vi.fn();
    act(() => { gameManager.start("snake"); });
    const { unmount } = renderHook(() => useArcadeGameLoop(tick, 100));

    act(() => { vi.advanceTimersByTime(100); });
    unmount();
    act(() => { vi.advanceTimersByTime(1000); });
    expect(tick).toHaveBeenCalledTimes(1);
  });

  it("raises the restart revision so the economy gate reopens its settle lock", () => {
    act(() => { gameManager.start("snake"); });
    const before = gameManager.getSnapshot().revision;
    act(() => { gameManager.restart(); });
    expect(gameManager.getSnapshot().revision).toBe(before + 1);
    expect(gameManager.getSnapshot().status).toBe("running");
  });

  it("keeps the highest score across a round but resets it on a new session", () => {
    act(() => { gameManager.start("snake"); });
    act(() => { gameManager.recordScore(500); gameManager.recordScore(120); });
    expect(gameManager.getSnapshot().score).toBe(500);
    act(() => { gameManager.restart(); });
    expect(gameManager.getSnapshot().score).toBe(0);
  });
});
