/* eslint-disable react-refresh/only-export-components -- the game economy context intentionally exports its provider and consumer hook */
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { GameErrorBoundary } from "./GameErrorBoundary";
import { GameWinCelebration } from "./GameWinCelebration";
import { Link, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArcadeGameExperience } from "@/features/arcade/ArcadeGameExperience";
import { gameManager } from "@/features/arcade/core/gameManager";
import { accessibilityAudio } from "@/features/arcade/audio/AccessibilityAudioLayer";

type GameResult = "win" | "loss" | "draw";
type ArcadeResultResponse = { accepted?: boolean; vx_reward?: number; status?: string };
type RpcResult = { data: unknown; error: { message: string; code?: string } | null };
const callArcadeRpc = supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<RpcResult>;

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
  const { t } = useLanguage();
  const location = useLocation();
  const [entryStatus, setEntryStatus] = useState<"loading" | "ready" | "blocked">("loading");
  const [message, setMessage] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);
  const settledRef = useRef(false);
  const sessionRef = useRef(crypto.randomUUID());
  const startedAtRef = useRef(Date.now());
  const inputCountRef = useRef(0);
  const entryKey = `${location.pathname}:${gameTitle}`;

  useEffect(() => {
    settledRef.current = false;
    sessionRef.current = crypto.randomUUID();
    startedAtRef.current = Date.now();
    inputCountRef.current = 0;
    setEntryStatus("loading");
    setMessage("");
    if (!user) { setEntryStatus("blocked"); setMessage(t("game.loginToPlay")); }
    else setEntryStatus("ready");
  }, [entryKey, t, user]);

  useEffect(() => {
    const countInput = (event: Event) => { if (event.isTrusted) inputCountRef.current += 1; };
    window.addEventListener("keydown", countInput);
    window.addEventListener("pointerdown", countInput);
    window.addEventListener("touchstart", countInput);
    return () => { window.removeEventListener("keydown", countInput); window.removeEventListener("pointerdown", countInput); window.removeEventListener("touchstart", countInput); };
  }, [entryKey]);

  const settleGameResult = useCallback(
    async (result: GameResult, _resultLabel?: string) => {
      if (!user || settledRef.current) return false;
      settledRef.current = true;
      const duration = Math.max(2, Math.round((Date.now() - startedAtRef.current) / 1000));
      const { data, error } = await callArcadeRpc("arcade_submit_verified_result", {
        _session_id: sessionRef.current, _game_id: location.pathname.replace(/^\/games\//, ""),
        _score: gameManager.getSnapshot().score, _result: result, _duration_seconds: duration, _input_count: inputCountRef.current,
        _integrity_hash: null, _replay_data: null,
      });
      const verified = data as ArcadeResultResponse | null;

      if (result === "win") {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3500);
        gameManager.complete("win");
        accessibilityAudio.announce(`${gameTitle}. Victory.`, "success");
        if (error) toast({ title: "تم حفظ الفوز محلياً", description: "مزامنة المكافآت الآمنة تنتظر تفعيل نظام Arcade على الخادم." });
        else if (!verified?.accepted) toast({ title: "النتيجة قيد المراجعة", description: "لن تُمنح VX قبل اكتمال التحقق الخادمي." });
        else if ((verified.vx_reward ?? 0) > 0) toast({ title: `+${verified.vx_reward} VX`, description: "مكافأة إنجاز موثّقة." });
        return !error && Boolean(verified?.accepted);
      }
      gameManager.complete(result);
      accessibilityAudio.announce(`${gameTitle}. ${result === "draw" ? "Draw." : "Round lost."}`, result === "draw" ? "status" : "failure");
      return !error && Boolean(verified?.accepted);
    },
    [gameTitle, location.pathname, user]
  );

  const value = useMemo(() => ({ settleGameResult }), [settleGameResult]);

  if (entryStatus === "loading") {
    return (
      <div role="status" aria-live="polite" className="flex min-h-screen flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        Loading game…
      </div>
    );
  }

  if (entryStatus === "blocked") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md border-destructive/40">
          <CardContent className="space-y-4 p-6 text-center">
            <h1 className="text-xl font-bold">{t("game.vxRequired")}</h1>
            <p className="text-sm text-muted-foreground">{message}</p>
            <div className="flex justify-center gap-2">
              {!user && (
                <>
                  <Button asChild>
                    <Link to="/login">{t("nav.login")}</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link to="/signup">{t("game.signUp")}</Link>
                  </Button>
                </>
              )}
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
        <ArcadeGameExperience>{children}</ArcadeGameExperience>
      </GameErrorBoundary>
    </GameEconomyContext.Provider>
  );
}
