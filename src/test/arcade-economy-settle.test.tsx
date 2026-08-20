import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const submitted = vi.fn();

vi.mock("@/contexts/AuthContext", () => {
  // Identity must be stable, exactly as AuthProvider state is: a fresh user
  // object per render would re-run the gate entry effect and hide the bug.
  const auth = { user: { id: "player-1" }, session: null, loading: false };
  return { useAuth: () => auth };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (name: string, args: Record<string, unknown>) => {
      submitted(name, args);
      return Promise.resolve({ data: { accepted: true, vx_reward: 5 }, error: null });
    },
  },
}));

vi.mock("@/features/arcade/ArcadeGameExperience", () => ({
  ArcadeGameExperience: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/contexts/LanguageContext", () => {
  // The real provider memoises t, so the gate's entry effect must not re-run
  // on every render. A fresh t per render would mask the settle-lock bug.
  const language = { t: (key: string) => key, lang: "en", ready: true };
  return { useLanguage: () => language };
});

import { GameEconomyGate, useGameEconomy } from "@/components/game/GameEconomyGate";
import { gameManager } from "@/features/arcade/core/gameManager";

function Player() {
  const { settleGameResult } = useGameEconomy();
  return <button type="button" onClick={() => void settleGameResult("win", "Snake")}>finish round</button>;
}

beforeEach(() => {
  submitted.mockClear();
  gameManager.start("snake");
});

afterEach(() => {
  cleanup();
  gameManager.stop();
});

describe("game economy settle lock", () => {
  it("settles every round, not only the first one before a restart", async () => {
    render(
      <MemoryRouter initialEntries={["/games/snake"]}>
        <GameEconomyGate gameTitle="Snake"><Player /></GameEconomyGate>
      </MemoryRouter>,
    );

    const finish = await screen.findByRole("button", { name: "finish round" });
    await act(async () => { fireEvent.click(finish); });
    expect(submitted).toHaveBeenCalledTimes(1);

    // A second settle inside the same round must still be rejected.
    await act(async () => { fireEvent.click(finish); });
    expect(submitted).toHaveBeenCalledTimes(1);

    await act(async () => { gameManager.restart(); });

    await act(async () => { fireEvent.click(finish); });
    expect(submitted, "the round after a restart must reach the server too").toHaveBeenCalledTimes(2);

    const [firstSession, secondSession] = submitted.mock.calls.map(
      ([, args]) => (args as { _session_id: string })._session_id,
    );
    expect(secondSession).not.toBe(firstSession);
  });
});
