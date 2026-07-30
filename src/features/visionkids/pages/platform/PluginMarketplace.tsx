import { useState } from "react";
import { Check, Download, Trash2, Lock } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { usePlugins, useInstalls, useInstallPlugin, useUninstallPlugin } from "@/features/visionkids/hooks/platform/usePlatform";
import { PLUGIN_CATEGORIES, PLATFORM_COLOR_CLASSES } from "@/features/visionkids/data/platformConfig";
import { PlatformHeader } from "@/features/visionkids/components/platform/PlatformHeader";

export default function PluginMarketplace() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [category, setCategory] = useState<string>("all");
  const { data: plugins = [], isLoading } = usePlugins(category);
  const { data: installs = [] } = useInstalls();
  const install = useInstallPlugin();
  const uninstall = useUninstallPlugin();

  useDocumentHead({
    title: `${t("kids.platform.nav.marketplace")} — VisionKids`,
    description: t("kids.platform.marketplace.subtitle"),
    canonicalPath: "/kids/platform/marketplace",
  });

  const installedSet = new Set(installs.map((i) => i.plugin_slug));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <PlatformHeader emoji="🧩" title={t("kids.platform.nav.marketplace")} subtitle={t("kids.platform.marketplace.subtitle")} />

      <div className="mt-5 flex flex-wrap gap-2">
        {PLUGIN_CATEGORIES.map((c) => (
          <button key={c} type="button" onClick={() => setCategory(c)} aria-current={category === c ? "true" : undefined}
            className={`rounded-full border-2 px-3 py-1 text-sm font-semibold transition-colors ${category === c ? "border-kids-primary bg-kids-primary/10 text-kids-primary" : "border-border hover:border-kids-primary/50"}`}>
            {t(`kids.platform.category.${c}`)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : plugins.length === 0 ? (
        <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.platform.marketplace.empty")}</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {plugins.map((p) => {
            const installed = installedSet.has(p.slug);
            return (
              <div key={p.slug} className={`flex flex-col gap-2 rounded-2xl border-2 p-4 ${PLATFORM_COLOR_CLASSES[p.color]}`}>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-3xl" aria-hidden="true">{p.emoji}</span>
                  <span className="rounded-full bg-background/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">{t(`kids.platform.category.${p.category}`)}</span>
                </div>
                <p className="font-heading text-base font-bold leading-tight">{p.name}</p>
                {p.summary && <p className="text-sm text-foreground/70">{p.summary}</p>}
                {p.permissions.length > 0 && (
                  <p className="flex items-center gap-1 text-[11px] text-foreground/60"><Lock className="h-3 w-3" aria-hidden="true" /> {p.permissions.join(", ")}</p>
                )}
                <div className="mt-auto pt-1">
                  {p.is_core ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-kids-green/15 px-3 py-1.5 text-xs font-bold text-kids-green">
                      <Check className="h-3.5 w-3.5" aria-hidden="true" /> {t("kids.platform.marketplace.core")}
                    </span>
                  ) : installed ? (
                    <button type="button" onClick={() => uninstall.mutate(p.slug)} disabled={!user || uninstall.isPending}
                      className="inline-flex items-center gap-1 rounded-full border-2 border-kids-pink px-3 py-1.5 text-xs font-bold text-kids-pink hover:bg-kids-pink/10 disabled:opacity-50">
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> {t("kids.platform.marketplace.uninstall")}
                    </button>
                  ) : (
                    <button type="button" onClick={() => install.mutate(p.slug)} disabled={!user || install.isPending}
                      className="inline-flex items-center gap-1 rounded-full bg-kids-primary px-4 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50">
                      <Download className="h-3.5 w-3.5" aria-hidden="true" /> {t("kids.platform.marketplace.install")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {!user && <p className="mt-4 text-sm text-muted-foreground">{t("kids.platform.signInHint")}</p>}
    </div>
  );
}
