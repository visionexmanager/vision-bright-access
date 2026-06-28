import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import {
  listProviders,
  createProvider,
  updateProvider,
  deleteProvider,
  testProvider,
} from "@/services/ai-media-studio/providerHubService";
import type { ProviderType, CreateProviderInput, UpdateProviderInput } from "@/lib/types/provider-hub";

export const PH_PROVIDERS_KEY = ["ph", "providers"] as const;

export function useProviders(type?: ProviderType) {
  return useQuery({
    queryKey: [...PH_PROVIDERS_KEY, type ?? "all"],
    queryFn:  () => listProviders(type),
    staleTime: 30_000,
  });
}

export function useProviderMutations() {
  const qc = useQueryClient();

  const invalidate = () => qc.invalidateQueries({ queryKey: PH_PROVIDERS_KEY });

  const create = useMutation({
    mutationFn: (input: CreateProviderInput) => createProvider(input),
    onSuccess: () => {
      invalidate();
      toast({ title: "Provider created" });
    },
    onError: (e: Error) => toast({ title: "Create failed", description: e.message, variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateProviderInput }) =>
      updateProvider(id, patch),
    onSuccess: () => {
      invalidate();
      toast({ title: "Provider updated" });
    },
    onError: (e: Error) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteProvider(id),
    onSuccess: () => {
      invalidate();
      toast({ title: "Provider deleted" });
    },
    onError: (e: Error) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      updateProvider(id, { status: active ? "active" : "inactive" }),
    onSuccess: invalidate,
    onError: () => toast({ title: "Toggle failed", variant: "destructive" }),
  });

  const setPriority = useMutation({
    mutationFn: ({ id, priority }: { id: string; priority: number }) =>
      updateProvider(id, { priority }),
    onSuccess: invalidate,
  });

  const test = useMutation({
    mutationFn: (id: string) => testProvider(id),
    onSuccess: (result) => {
      if (result.healthy) {
        toast({ title: "Provider is healthy", description: `Latency: ${result.latency_ms}ms` });
      } else {
        toast({ title: "Provider unhealthy", description: result.error, variant: "destructive" });
      }
      invalidate();
    },
    onError: (e: Error) => toast({ title: "Test failed", description: e.message, variant: "destructive" }),
  });

  return { create, update, remove, toggleStatus, setPriority, test };
}
