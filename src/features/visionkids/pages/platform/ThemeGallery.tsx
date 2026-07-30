import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useThemes, useThemePref, useSetThemePref } from "@/features/visionkids/hooks/platform/usePlatform";
import { applyKidsTheme, getStoredKidsTheme } from "@/features/visionkids/platform/themeEngine";
import { PlatformHeader } from "@/features/visionkids/components/platform/PlatformHeader";

export default function ThemeGallery() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: themes = [] } = useThemes();
  const { data: serverTheme } = useThemePref();
  const setPref = useSetThemePref();

  const [active, setActive] = useState<string>(() => getStoredKidsTheme());

  // Hydrate from the signed-in child's server preference.
  useEffect(() => {
    if (serverTheme) {
      setActive(serverTheme);
      applyKidsTheme(serverTheme);
    }
  }, [serverTheme]);

  useDocumentHead({
    title: `${t("kids.platform.nav.themes")} — VisionKids`,
    description: t("kids.platform.themes.subtitle"),
    canonicalPath: "/kids/platform/themes",
  });

  function choose(slug: string) {
    setActive(slug);
    applyKidsTheme(slug);
    if (user) setPref.mutate(slug);
  }

  const seasonal = themes.filter((th) => th.is_seasonal);
  const standard = themes.filter((th) => !th.is_seasonal);

  function grid(list: typeof themes) {
    return (
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {list.map((th) => (
          <button key={th.slug} type="button" onClick={() => choose(th.data_theme)} aria-pressed={active === th.data_theme}
            className={`relative flex flex-col items-center gap-2 rounded-2xl border-2 p-5 transition-transform hover:scale-[1.03] ${active === th.data_theme ? "border-kids-primary bg-kids-primary/10" : "border-border bg-card"}`}>
            {active === th.data_theme && <Check className="absolute end-2 top-2 h-4 w-4 text-kids-primary" aria-hidden="true" />}
            <span className="text-4xl" aria-hidden="true">{th.emoji}</span>
            <span className="text-sm font-bold">{th.name}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t(`kids.platform.themeVariant.${th.variant}`)}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <PlatformHeader emoji="🎨" title={t("kids.platform.nav.themes")} subtitle={t("kids.platform.themes.subtitle")} />

      <section className="mt-6">
        <h2 className="font-heading text-lg font-bold">{t("kids.platform.themes.standard")}</h2>
        {grid(standard)}
      </section>

      {seasonal.length > 0 && (
        <section className="mt-8">
          <h2 className="font-heading text-lg font-bold">{t("kids.platform.themes.seasonal")}</h2>
          {grid(seasonal)}
        </section>
      )}

      {!user && <p className="mt-6 text-sm text-muted-foreground">{t("kids.platform.themes.localNote")}</p>}
    </div>
  );
}
