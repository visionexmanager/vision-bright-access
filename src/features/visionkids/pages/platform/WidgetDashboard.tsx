import { useEffect, useMemo, useState } from "react";
import { Pencil, Check, Plus, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useWidgetCatalog, useDashboard, useSetDashboard } from "@/features/visionkids/hooks/platform/usePlatform";
import { getWidgetComponent } from "@/features/visionkids/platform/widgetRegistry";
import { PlatformHeader } from "@/features/visionkids/components/platform/PlatformHeader";

const DEFAULT_WIDGETS = ["clock", "todays-challenge", "progress", "calendar"];
const SIZE_SPAN: Record<string, string> = { small: "sm:col-span-1", medium: "sm:col-span-2", large: "sm:col-span-3" };

export default function WidgetDashboard() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: catalog = [] } = useWidgetCatalog();
  const { data: dashboard = [], isLoading } = useDashboard();
  const setDashboard = useSetDashboard();

  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  // Hydrate selection from saved dashboard (or defaults for a fresh user).
  useEffect(() => {
    if (dashboard.length > 0) setSelected(dashboard.map((d) => d.widget_slug));
    else if (!isLoading) setSelected(DEFAULT_WIDGETS);
  }, [dashboard, isLoading]);

  const sizeBySlug = useMemo(() => new Map(catalog.map((w) => [w.slug, w.size])), [catalog]);

  useDocumentHead({
    title: `${t("kids.platform.nav.dashboard")} — VisionKids`,
    description: t("kids.platform.dashboard.subtitle"),
    canonicalPath: "/kids/platform/dashboard",
  });

  function toggle(slug: string) {
    setSelected((s) => (s.includes(slug) ? s.filter((x) => x !== slug) : [...s, slug]));
  }

  async function save() {
    await setDashboard.mutateAsync(selected).catch(() => {});
    setEditing(false);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex items-start justify-between gap-3">
        <PlatformHeader emoji="🖥️" title={t("kids.platform.nav.dashboard")} subtitle={t("kids.platform.dashboard.subtitle")} />
        {user && (
          editing ? (
            <button type="button" onClick={save} disabled={setDashboard.isPending}
              className="mt-8 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-kids-primary px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50">
              <Check className="h-4 w-4" aria-hidden="true" /> {t("kids.platform.dashboard.done")}
            </button>
          ) : (
            <button type="button" onClick={() => setEditing(true)}
              className="mt-8 inline-flex shrink-0 items-center gap-1.5 rounded-full border-2 border-border px-4 py-2 text-sm font-bold hover:border-kids-primary/50">
              <Pencil className="h-4 w-4" aria-hidden="true" /> {t("kids.platform.dashboard.edit")}
            </button>
          )
        )}
      </div>

      {!user && <p className="mt-6 rounded-2xl border-2 border-dashed border-border p-4 text-sm text-muted-foreground">{t("kids.platform.dashboard.signInHint")}</p>}

      {/* Editor: choose widgets */}
      {editing && (
        <div className="mt-5 rounded-2xl border-2 border-border bg-card p-4">
          <p className="text-sm font-semibold">{t("kids.platform.dashboard.chooseWidgets")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {catalog.map((w) => {
              const on = selected.includes(w.slug);
              return (
                <button key={w.slug} type="button" onClick={() => toggle(w.slug)} aria-pressed={on}
                  className={`inline-flex items-center gap-1 rounded-xl border-2 px-3 py-1.5 text-sm font-semibold transition-colors ${on ? "border-kids-green bg-kids-green/10 text-kids-green" : "border-border hover:border-kids-primary/50"}`}>
                  <span aria-hidden="true">{w.emoji}</span> {w.name}
                  {on ? <X className="h-3.5 w-3.5" aria-hidden="true" /> : <Plus className="h-3.5 w-3.5" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* The dashboard grid */}
      {selected.length === 0 ? (
        <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.platform.dashboard.empty")}</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {selected.map((slug) => {
            const Comp = getWidgetComponent(slug);
            if (!Comp) return null;
            return (
              <div key={slug} className={SIZE_SPAN[sizeBySlug.get(slug) ?? "small"]}>
                <Comp />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
