import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Coins, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useVXWallet } from "@/hooks/useVXWallet";
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
  const { t } = useLanguage();
  const location = useLocation();
  const [entryStatus, setEntryStatus] = useState<"loading" | "ready" | "blocked">("loading");
  const [message, setMessage] = useState("");
  const settledRef = useRef(false);
  const entryKey = `${location.pathname}:${gameTitle}`;

  useEffect(() => {
    let cancelled = false;
    settledRef.current = false;
    setEntryStatus("loading");
    setMessage("");

    const chargeEntry = async () => {
      if (!user) {
        setEntryStatus("blocked");
        setMessage("سجل الدخول حتى يتم خصم تكلفة بدء اللعبة وحفظ رصيد VX.");
        return;
      }

      const ok = await spendVX(
        GAMING_PRICES.singlePlay,
        "game-entry",
        gameTitle,
        location.pathname,
        { chargeDuringTrial: true, suppressToast: true }
      );

      if (cancelled) return;

      if (!ok) {
        setEntryStatus("blocked");
        setMessage(`تحتاج ${GAMING_PRICES.singlePlay.toLocaleString()} VX لبدء اللعبة.`);
        return;
      }

      setEntryStatus("ready");
    };

    chargeEntry();

    return () => {
      cancelled = true;
    };
  }, [entryKey, gameTitle, location.pathname, spendVX, user]);

  const settleGameResult = useCallback(
    async (result: GameResult, resultLabel?: string) => {
      if (!user || settledRef.current || result === "draw") return false;
      settledRef.current = true;

      if (result === "win") {
        const { error } = await supabase.rpc("award_points", {
          _points: GAMING_PRICES.winReward,
          _reason: `Game win reward: ${resultLabel ?? gameTitle}`,
        });

        if (error) {
          settledRef.current = false;
          toast({ title: "Game reward failed", description: error.message, variant: "destructive" });
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
        { chargeDuringTrial: true, suppressToast: true }
      );

      if (ok) {
        toast({ title: `-${GAMING_PRICES.lossPenalty} VX`, description: t("game.lossDeducted") });
      } else {
        settledRef.current = false;
      }
      return ok;
    },
    [gameTitle, location.pathname, spendVX, user]
  );

  const value = useMemo(() => ({ settleGameResult }), [settleGameResult]);

  if (entryStatus === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        {t("game.chargingEntry").replace("{n}", String(GAMING_PRICES.singlePlay))}
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
      {children}
    </GameEconomyContext.Provider>
  );
}
