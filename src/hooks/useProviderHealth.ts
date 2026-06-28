import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import {
  checkProviderHealth,
  routeProvider,
  getHubConfig,
  updateHubConfig,
} from "@/services/ai-media-studio/providerHubService";
import type {
  ProviderType,
  RoutingPreferences,
  RoutingDecision,
  HubConfig,
} from "@/lib/types/provider-hub";

// ── Health checks ─────────────────────────────────────────────────────────────

export function useProviderHealth(autoRefresh = false) {
  return useQuery({
    queryKey: ["ph", "health"],
    queryFn:  () => checkProviderHealth(),
    staleTime: 30_000,
    refetchInterval: autoRefresh ? 60_000 : false,
  });
}

export function useHealthCheck() {
  const qc = useQueryClient();

  const check = useMutation({
    mutationFn: (providerId?: string) => checkProviderHealth(providerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ph"] });
      toast({ title: "Health check complete" });
    },
    onError: () => toast({ title: "Health check failed", variant: "destructive" }),
  });

  return { check };
}

// ── Smart routing ─────────────────────────────────────────────────────────────

export function useRouteProvider() {
  const [decision, setDecision] = useState<RoutingDecision | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const route = useCallback(async (
    type: ProviderType,
    preferences?: RoutingPreferences,
    signal?: AbortSignal
  ): Promise<RoutingDecision | null> => {
    setLoading(true);
    setError(null);
    try {
      const d = await routeProvider(type, preferences, signal);
      setDecision(d);
      return d;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Routing failed";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { route, decision, loading, error };
}

// ── Hub config ────────────────────────────────────────────────────────────────

export function useHubConfig() {
  return useQuery({
    queryKey: ["ph", "config"],
    queryFn:  getHubConfig,
    staleTime: 300_000,
  });
}

export function useHubConfigMutation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (patch: Partial<HubConfig>) => updateHubConfig(patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ph", "config"] });
      toast({ title: "Settings saved" });
    },
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });
}
