import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { usePlugins, useInstalls, useTogglePlugin, useUninstallPlugin } from "@/features/visionkids/hooks/platform/usePlatform";
import { resolvePluginRoute } from "@/features/visionkids/platform/pluginRegistry";
import { PlatformHeader } from "@/features/visionkids/components/platform/PlatformHeader";

export default function MyPlugins() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: plugins = [] } = usePlugins("all");
  const { data: installs = [] } = useInstalls();
  const toggle = useTogglePlugin();
  const uninstall = useUninstallPlugin();

  useDocumentHead({
    title: `${t("kids.platform.nav.myPlugins")} — VisionKids`,
    description: t("kids.platform.myPlugins.subtitle"),
    canonicalPath: "/kids/platform/my-plugins",
  });

  const installMap = new Map(installs.map((i) => [i.plugin_slug, i]));
  const core = plugins.filter((p) => p.is_core);
  const optional = plugins.filter((p) => !p.is_core && installMap.has(p.slug));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <PlatformHeader emoji="📦" title={t("kids.platform.nav.myPlugins")} subtitle={t("kids.platform.myPlugins.subtitle")} />

      {!user ? (
        <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.platform.signInHint")}</p>
      ) : (
        <>
          <section className="mt-6">
            <h2 className="font-heading text-lg font-bold">{t("kids.platform.myPlugins.installed")}</h2>
            {optional.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {t("kids.platform.myPlugins.none")} <Link to="/kids/platform/marketplace" className="font-semibold text-kids-primary hover:underline">{t("kids.platform.nav.marketplace")}</Link>
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {optional.map((p) => {
                  const inst = installMap.get(p.slug)!;
                  return (
                    <li key={p.slug} className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-4">
                      <span className="text-2xl" aria-hidden="true">{p.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-heading font-bold leading-tight">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{t(`kids.platform.category.${p.category}`)}</p>
                      </div>
                      <Switch checked={inst.enabled} onCheckedChange={(c) => toggle.mutate({ slug: p.slug, enabled: c })} aria-label={t("kids.platform.myPlugins.toggle")} />
                      <button type="button" onClick={() => uninstall.mutate(p.slug)} disabled={uninstall.isPending}
                        className="rounded-full p-2 text-kids-pink hover:bg-kids-pink/10" title={t("kids.platform.marketplace.uninstall")}>
                        <Trash2 className="h-4 w-4" aria-label={t("kids.platform.marketplace.uninstall")} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="mt-8">
            <h2 className="font-heading text-lg font-bold">{t("kids.platform.myPlugins.coreTitle")}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{t("kids.platform.myPlugins.coreHint")}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {core.map((p) => {
                const route = resolvePluginRoute(p);
                const inner = (
                  <>
                    <span className="text-2xl" aria-hidden="true">{p.emoji}</span>
                    <span className="text-sm font-semibold">{p.name}</span>
                  </>
                );
                return route ? (
                  <Link key={p.slug} to={route} className="flex flex-col items-center gap-1 rounded-2xl border-2 border-border bg-card p-3 text-center hover:border-kids-primary/50">{inner}</Link>
                ) : (
                  <div key={p.slug} className="flex flex-col items-center gap-1 rounded-2xl border-2 border-border bg-card p-3 text-center">{inner}</div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
