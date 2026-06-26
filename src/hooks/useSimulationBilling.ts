import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useVXWallet } from "@/hooks/useVXWallet";
import { useTrial } from "@/hooks/useTrial";
import { SIMULATION_PRICES } from "@/systems/pricingSystem";
import { isFallbackSimulationId } from "@/data/requiredSimulations";

type BillingStatus = "idle" | "loading" | "ready" | "blocked";

const QUARTER_SECONDS = SIMULATION_PRICES.quarterMinutes * 60;
const PERSIST_EVERY_SECONDS = 10;

export function useSimulationBilling(
  simulationId: string | undefined,
  simulationTitle: string,
  enabled: boolean
) {
  const { user } = useAuth();
  const { spendVX } = useVXWallet();
  const { isOnTrial } = useTrial();
  const [status, setStatus] = useState<BillingStatus>("idle");
  const [message, setMessage] = useState("");
  const [usageSeconds, setUsageSeconds] = useState(0);
  const [paidSeconds, setPaidSeconds] = useState(0);
  const [isCharging, setIsCharging] = useState(false);

  const usageRef = useRef(0);
  const paidRef = useRef(0);
  const persistAtRef = useRef(0);
  const chargingRef = useRef(false);

  const localBillingKey = useMemo(
    () => (user && simulationId ? `visionex:simulation-billing:${user.id}:${simulationId}` : ""),
    [simulationId, user]
  );

  const persistUsage = useCallback(async () => {
    if (!user || !simulationId) return;
    if (isFallbackSimulationId(simulationId)) {
      localStorage.setItem(
        localBillingKey,
        JSON.stringify({ usage_seconds: usageRef.current, paid_seconds: paidRef.current })
      );
      return;
    }
    await supabase
      .from("simulation_progress")
      .update({ usage_seconds: usageRef.current, paid_seconds: paidRef.current })
      .eq("user_id", user.id)
      .eq("simulation_id", simulationId);
  }, [localBillingKey, simulationId, user]);

  const ensureQuarter = useCallback(async () => {
    if (!user || !simulationId || chargingRef.current) return false;
    if (paidRef.current > usageRef.current) return true;

    chargingRef.current = true;
    setIsCharging(true);
    setStatus("loading");

    const ok = await spendVX(
      SIMULATION_PRICES.quarterHour,
      "simulation-time",
      simulationTitle,
      simulationId
    );

    if (!ok) {
      setStatus("blocked");
      setMessage(`تحتاج ${SIMULATION_PRICES.quarterHour.toLocaleString()} VX لفتح ربع ساعة إضافي في هذه السيميليشن.`);
      chargingRef.current = false;
      setIsCharging(false);
      return false;
    }

    const nextPaid = paidRef.current + QUARTER_SECONDS;
    paidRef.current = nextPaid;
    setPaidSeconds(nextPaid);
    await persistUsage();
    setMessage("");
    setStatus("ready");
    chargingRef.current = false;
    setIsCharging(false);
    return true;
  }, [persistUsage, simulationId, simulationTitle, spendVX, user]);

  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      return;
    }

    let cancelled = false;

    const loadBilling = async () => {
      if (!user) {
        setStatus("blocked");
        setMessage("سجل الدخول حتى يتم حفظ وقت استخدام السيميليشن وحساب VX بدقة.");
        return;
      }

      if (!simulationId) return;
      setStatus("loading");

      if (isFallbackSimulationId(simulationId)) {
        const raw = localStorage.getItem(localBillingKey);
        const existing = raw ? JSON.parse(raw) : null;
        usageRef.current = existing?.usage_seconds ?? 0;
        paidRef.current = existing?.paid_seconds ?? 0;
        setUsageSeconds(usageRef.current);
        setPaidSeconds(paidRef.current);
        persistAtRef.current = usageRef.current;
        await ensureQuarter();
        return;
      }

      const { data: existing, error } = await supabase
        .from("simulation_progress")
        .select("usage_seconds, paid_seconds")
        .eq("user_id", user.id)
        .eq("simulation_id", simulationId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        setStatus("blocked");
        setMessage(error.message);
        return;
      }

      if (!existing) {
        const { data: created, error: insertError } = await supabase
          .from("simulation_progress")
          .insert([{
            user_id: user.id,
            simulation_id: simulationId,
            current_step: 0,
            decisions: [],
            score: 0,
            completed: false,
          }])
          .select("usage_seconds, paid_seconds")
          .single();

        if (cancelled) return;
        if (insertError) {
          setStatus("blocked");
          setMessage(insertError.message);
          return;
        }

        usageRef.current = created.usage_seconds ?? 0;
        paidRef.current = created.paid_seconds ?? 0;
      } else {
        usageRef.current = existing.usage_seconds ?? 0;
        paidRef.current = existing.paid_seconds ?? 0;
      }

      setUsageSeconds(usageRef.current);
      setPaidSeconds(paidRef.current);
      persistAtRef.current = usageRef.current;
      await ensureQuarter();
    };

    loadBilling();

    return () => {
      cancelled = true;
    };
  }, [enabled, ensureQuarter, localBillingKey, simulationId, user]);

  useEffect(() => {
    if (!enabled || status !== "ready") return;

    let lastTick = Date.now();
    const interval = window.setInterval(async () => {
      const now = Date.now();
      const elapsed = Math.max(1, Math.floor((now - lastTick) / 1000));
      lastTick = now;

      usageRef.current += elapsed;
      setUsageSeconds(usageRef.current);

      if (usageRef.current - persistAtRef.current >= PERSIST_EVERY_SECONDS) {
        persistAtRef.current = usageRef.current;
        await persistUsage();
      }

      if (usageRef.current >= paidRef.current) {
        await persistUsage();
        await ensureQuarter();
      }
    }, 1000);

    return () => {
      window.clearInterval(interval);
      void persistUsage();
    };
  }, [enabled, ensureQuarter, persistUsage, status]);

  const remainingSeconds = Math.max(0, paidSeconds - usageSeconds);
  const remainingMinutes = useMemo(
    () => Math.floor(remainingSeconds / 60),
    [remainingSeconds]
  );

  return {
    status,
    message,
    isCharging,
    usageSeconds,
    paidSeconds,
    remainingSeconds,
    remainingMinutes,
    isFreeTrial: isOnTrial,
  };
}
