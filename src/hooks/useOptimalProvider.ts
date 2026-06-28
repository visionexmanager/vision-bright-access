// Integration hook: resolves the optimal provider for a given type.
// Speech Studio, Voice Studio, and Video Studio use this to pass
// provider information to their edge functions via the hub.

import { useCallback } from "react";
import { useProviders } from "@/hooks/useProviders";
import type { Provider, ProviderType, RoutingPreferences } from "@/lib/types/provider-hub";

interface ProviderScore extends Provider {
  score: number;
}

function computeScore(p: Provider): number {
  const latencyScore  = Math.max(0, 100 - (p.avg_latency_ms / 20));
  const costScore     = Math.max(0, 100 - (p.cost_per_request * 500));
  const healthScore   = p.health_score;
  const priorityScore = Math.max(0, 100 - p.priority);
  return latencyScore * 0.25 + costScore * 0.20 + healthScore * 0.40 + priorityScore * 0.15;
}

export function useOptimalProvider(type: ProviderType) {
  const { data: providers = [], isLoading } = useProviders(type);

  const resolve = useCallback((prefs?: RoutingPreferences): Provider | null => {
    let eligible = providers.filter(
      (p) =>
        p.status !== "inactive" &&
        p.health_score > 20 &&
        !(prefs?.excludeSlugs?.includes(p.slug))
    );

    if (prefs?.requireCapabilities?.length) {
      const req = prefs.requireCapabilities;
      eligible = eligible.filter((p) => req.every((c) => p.capabilities.includes(c)));
    }

    if (!eligible.length) return null;

    if (prefs?.preferredSlug) {
      const preferred = eligible.find((p) => p.slug === prefs.preferredSlug!);
      if (preferred) return preferred;
    }

    const scored: ProviderScore[] = eligible.map((p) => ({
      ...p,
      score: computeScore(p),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored[0] ?? null;
  }, [providers]);

  const primary = resolve();

  return {
    providers,
    primary,
    resolve,
    isLoading,
    hasActive: providers.some((p) => p.status === "active"),
  };
}
