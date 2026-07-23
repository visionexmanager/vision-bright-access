/* eslint-disable react-refresh/only-export-components -- the game economy context intentionally exports its provider and consumer hook */
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { GameErrorBoundary } from "./GameErrorBoundary";
import { GameWinCelebration } from "./GameWinCelebration";
import { Link, useLocation } from "react-router-dom";
import { Coins, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useVXWallet } from "@/hooks/useVXWallet";
import { useTrial } from "@/hooks/useTrial";
import { GAMING_PRICES } from "@/systems/pricingSystem";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

type GameResult = "win" | "loss" | "draw";

type GameEconomyContextValue = {
  settleGameResult: (result: GameResult, resultLabel?: string) => Promise<boolean>;
};

const GameEconomyContext = createContext<GameEconomyContextValue | null>(null);

export function useGameEconomy() {
  const value = useContext(GameEconomyContext);
  return value ?? { settleGameResult: async () => false };
}

interface GameEconomyGateProps {
  gameTitle: string;
  children: ReactNode;
}

export function GameEconomyGate({ gameTitle, children }: GameEconomyGateProps) {
  const { user } = useAuth();
  const { spendVX } = useVXWallet();
  const { isOnTrial } = useTrial();
  const { t } = useLanguage();
  const location = useLocation();
  const [entryStatus, setEntryStatus] = useState<"loading" | "ready" | "blocked">("loading");
  const [message, setMessage] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);
  const settledRef = useRef(false);
  const entryKey = `${location.pathname}:${gameTitle}`;

  // Hold latest spendVX in a ref so the entry effect doesn't re-fire when
  // balance updates (which recreates spendVX on every successful charge).
  const spendVXRef = useRef(spendVX);
  useEffect(() => { spendVXRef.current = spendVX; }, [spendVX]);

  useEffect(() => {
    let cancelled = false;
    settledRef.current = false;
    setEntryStatus("loading");
    setMessage("");

    const chargeEntry = async () => {
      if (!user) {
        setEntryStatus("blocked");
        setMessage(t("game.loginToPlay"));
        return;
      }

      const ok = await spendVXRef.current(
        GAMING_PRICES.singlePlay,
        "game-entry",
        gameTitle,
        location.pathname,
        { suppressToast: true }
      );

      if (cancelled) return;

      if (!ok) {
        setEntryStatus("blocked");
        setMessage(
          t("game.insufficientVX").replace(
            "{n}",
            GAMING_PRICES.singlePlay.toLocaleString(),
          ),
        );
        return;
      }

      setEntryStatus("ready");
    };

    chargeEntry();

    return () => {
      cancelled = true;
    };
  // Only re-run when the user, language, or game route changes — NOT when spendVX
  // recreates after a balance update, which was causing repeated charges.
  }, [entryKey, t, user?.id]);

  const settleGameResult = useCallback(
    async (result: GameResult, resultLabel?: string) => {
      if (!user || settledRef.current || result === "draw") return false;
      settledRef.current = true;

      if (result === "win") {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3500);

        const { error } = await supabase.rpc("award_points", {
          _points: GAMING_PRICES.winReward,
          _reason: `Game win reward: ${resultLabel ?? gameTitle}`,
        });

        if (error) {
          settledRef.current = false;
          toast({ title: t("game.rewardFailed"), description: error.message, variant: "destructive" });
          return false;
        }

        toast({ title: `+${GAMING_PRICES.winReward} VX`, description: t("game.winRewardAdded") });
        return true;
      }

      const ok = await spendVX(
        GAMING_PRICES.lossPenalty,
        "game-loss",
        resultLabel ?? gameTitle,
        location.pathname,
        { suppressToast: true }
      );

      if (ok) {
        toast({ title: `-${GAMING_PRICES.lossPenalty} VX`, description: t("game.lossDeducted") });
      } else {
        settledRef.current = false;
      }
      return ok;
    },
    [gameTitle, location.pathname, spendVX, t, user]
  );

  const value = useMemo(() => ({ settleGameResult }), [settleGameResult]);

  if (entryStatus === "loading") {
    return (
      <div role="status" aria-live="polite" className="flex min-h-screen flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        {isOnTrial
          ? t("games.trialDesc")
          : t("game.chargingEntry").replace("{n}", String(GAMING_PRICES.singlePlay))}
      </div>
    );
  }

  if (entryStatus === "blocked") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md border-destructive/40">
          <CardContent className="space-y-4 p-6 text-center">
            <Coins className="mx-auto h-10 w-10 text-destructive" />
            <h1 className="text-xl font-bold">{t("game.vxRequired")}</h1>
            <p className="text-sm text-muted-foreground">{message}</p>
            <div className="flex justify-center gap-2">
              {!user && (
                <Button asChild>
                  <Link to="/signup">{t("game.signUp")}</Link>
                </Button>
              )}
              <Button asChild variant={user ? "default" : "outline"}>
                <Link to="/coins-store">{t("game.vxStore")}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <GameEconomyContext.Provider value={value}>
      <GameWinCelebration active={showConfetti} />
      <GameErrorBoundary
        gameName={gameTitle}
        errorTitle={t("game.errorTitle")}
        errorDescription={t("game.errorDescription").replace("{game}", gameTitle)}
        retryLabel={t("game.tryAgain")}
      >
        {children}
      </GameErrorBoundary>
    </GameEconomyContext.Provider>
  );
}
