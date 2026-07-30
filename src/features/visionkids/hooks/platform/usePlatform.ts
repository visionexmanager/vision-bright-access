import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as catalog from "@/features/visionkids/services/platform/catalog";
import * as installs from "@/features/visionkids/services/platform/installs";

// ── Catalog ──────────────────────────────────────────────────────────────────
export function usePlugins(category?: string) {
  return useQuery({ queryKey: ["kids-platform", "plugins", category ?? "all"], queryFn: () => catalog.fetchPlugins(category) });
}

export function usePluginVersions(slug: string | undefined) {
  return useQuery({
    queryKey: ["kids-platform", "versions", slug],
    queryFn: () => catalog.fetchPluginVersions(slug!),
    enabled: !!slug,
  });
}

export function useWidgetCatalog() {
  return useQuery({ queryKey: ["kids-platform", "widgets"], queryFn: catalog.fetchWidgets });
}

export function useThemes() {
  return useQuery({ queryKey: ["kids-platform", "themes"], queryFn: catalog.fetchThemes });
}

// ── User state ───────────────────────────────────────────────────────────────
export function usePlatformStats() {
  return useQuery({ queryKey: ["kids-platform", "stats"], queryFn: installs.fetchPlatformStats });
}

export function useInstalls() {
  return useQuery({ queryKey: ["kids-platform", "installs"], queryFn: installs.fetchInstalls });
}

function invalidateInstalls(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["kids-platform", "installs"] });
  qc.invalidateQueries({ queryKey: ["kids-platform", "stats"] });
}

export function useInstallPlugin() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (slug: string) => installs.installPlugin(slug), onSuccess: () => invalidateInstalls(qc) });
}

export function useUninstallPlugin() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (slug: string) => installs.uninstallPlugin(slug), onSuccess: () => invalidateInstalls(qc) });
}

export function useTogglePlugin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, enabled }: { slug: string; enabled: boolean }) => installs.togglePlugin(slug, enabled),
    onSuccess: () => invalidateInstalls(qc),
  });
}

export function useDashboard() {
  return useQuery({ queryKey: ["kids-platform", "dashboard"], queryFn: installs.fetchDashboard });
}

export function useSetDashboard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (widgetSlugs: string[]) => installs.setDashboard(widgetSlugs),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kids-platform", "dashboard"] });
      qc.invalidateQueries({ queryKey: ["kids-platform", "stats"] });
    },
  });
}

export function useThemePref() {
  return useQuery({ queryKey: ["kids-platform", "theme-pref"], queryFn: installs.fetchThemePref });
}

export function useSetThemePref() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) => installs.setThemePref(slug),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kids-platform", "theme-pref"] });
      qc.invalidateQueries({ queryKey: ["kids-platform", "stats"] });
    },
  });
}

export function useNotifications() {
  return useQuery({ queryKey: ["kids-platform", "notifications"], queryFn: installs.fetchNotifications });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string | null) => installs.markNotificationRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kids-platform", "notifications"] });
      qc.invalidateQueries({ queryKey: ["kids-platform", "stats"] });
    },
  });
}
