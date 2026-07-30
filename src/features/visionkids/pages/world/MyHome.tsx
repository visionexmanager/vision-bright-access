import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Save, Plus, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useMarketItems } from "@/features/visionkids/hooks/world/useWorldCatalog";
import { useHome, useInventory, useSaveHome } from "@/features/visionkids/hooks/world/useWorldProgress";
import { HOME_THEMES } from "@/features/visionkids/data/worldConfig";
import { WorldHeader } from "@/features/visionkids/components/world/WorldHeader";
import { WorldRewardBanner } from "@/features/visionkids/components/world/WorldRewardBanner";
import type { HomeTheme } from "@/features/visionkids/types/world.types";

export default function MyHome() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: home } = useHome();
  const { data: inventory = [] } = useInventory();
  const { data: allItems = [] } = useMarketItems("all");
  const save = useSaveHome();

  const [name, setName] = useState("My Home");
  const [theme, setTheme] = useState<HomeTheme>("cozy");
  const [placed, setPlaced] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  // Hydrate from the saved home once it loads.
  useEffect(() => {
    if (home) {
      setName(home.name);
      setTheme(home.theme);
      const roomsHome = (home.rooms as { home?: { placed?: string[] } })?.home;
      if (Array.isArray(roomsHome?.placed)) setPlaced(roomsHome!.placed!);
    }
  }, [home]);

  const itemBySlug = useMemo(() => new Map(allItems.map((i) => [i.slug, i])), [allItems]);
  // Decor / furniture / pets are the placeable/displayable items.
  const displayable = inventory.filter((i) => ["decor", "furniture", "pet"].includes(i.category));
  const pets = inventory.filter((i) => i.category === "pet");
  const themeBg = HOME_THEMES.find((th) => th.slug === theme)?.bg ?? HOME_THEMES[0].bg;

  useDocumentHead({
    title: `${t("kids.world.nav.myHome")} — VisionKids`,
    description: t("kids.world.myHome.subtitle"),
    canonicalPath: "/kids/world/my-home",
  });

  function toggle(slug: string) {
    setPlaced((p) => (p.includes(slug) ? p.filter((s) => s !== slug) : [...p, slug]));
  }

  async function onSave() {
    if (!user) return;
    // Merge into existing rooms so we never clobber the Dream City slice.
    const rooms = { ...(home?.rooms ?? {}), home: { placed } };
    try {
      await save.mutateAsync({ name: name.trim() || "My Home", theme, rooms });
      setSaved(true);
      setTimeout(() => setSaved(false), 2800);
    } catch { /* ignore */ }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <WorldHeader emoji="🏠" title={t("kids.world.nav.myHome")} subtitle={t("kids.world.myHome.subtitle")} />
      <WorldRewardBanner show={saved} message={t("kids.world.myHome.savedMsg")} />

      {!user ? (
        <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.world.myHome.signInHint")}</p>
      ) : (
        <>
          {/* Room preview */}
          <div className={`relative mt-6 grid min-h-[12rem] place-items-center gap-2 rounded-3xl border-2 border-border bg-gradient-to-b ${themeBg} p-6`}>
            {placed.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("kids.world.myHome.emptyRoom")}</p>
            ) : (
              <div className="flex flex-wrap items-end justify-center gap-3">
                {placed.map((slug) => (
                  <span key={slug} className="text-4xl" aria-hidden="true">{itemBySlug.get(slug)?.emoji ?? "📦"}</span>
                ))}
              </div>
            )}
          </div>

          {/* Name + theme */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40}
              aria-label={t("kids.world.myHome.nameLabel")}
              className="min-w-0 flex-1 rounded-xl border-2 border-border bg-background px-3 py-2 font-heading font-bold" />
            <button type="button" onClick={onSave} disabled={save.isPending}
              className="inline-flex items-center gap-1.5 rounded-full bg-kids-primary px-5 py-2 font-bold text-white hover:opacity-90 disabled:opacity-50">
              <Save className="h-4 w-4" aria-hidden="true" /> {t("kids.world.myHome.save")}
            </button>
          </div>

          <fieldset className="mt-4">
            <legend className="text-sm font-semibold">{t("kids.world.myHome.theme")}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {HOME_THEMES.map((th) => (
                <button key={th.slug} type="button" onClick={() => setTheme(th.slug)} aria-pressed={theme === th.slug}
                  className={`rounded-full border-2 px-3 py-1.5 text-sm font-semibold transition-colors ${theme === th.slug ? "border-kids-primary bg-kids-primary/10 text-kids-primary" : "border-border hover:border-kids-primary/50"}`}>
                  <span aria-hidden="true">{th.emoji}</span> {t(`kids.world.theme.${th.slug}`)}
                </button>
              ))}
            </div>
          </fieldset>

          {/* Owned items to place */}
          <section className="mt-6">
            <h2 className="font-heading text-lg font-bold">{t("kids.world.myHome.yourItems")}</h2>
            {displayable.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {t("kids.world.myHome.noItems")} <Link to="/kids/world/marketplace" className="font-semibold text-kids-primary hover:underline">{t("kids.world.nav.marketplace")}</Link>
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {displayable.map((inv) => {
                  const item = itemBySlug.get(inv.item_slug);
                  const isPlaced = placed.includes(inv.item_slug);
                  return (
                    <button key={inv.item_slug} type="button" onClick={() => toggle(inv.item_slug)} aria-pressed={isPlaced}
                      className={`inline-flex items-center gap-1 rounded-xl border-2 px-3 py-1.5 text-sm font-semibold transition-colors ${isPlaced ? "border-kids-green bg-kids-green/10 text-kids-green" : "border-border hover:border-kids-primary/50"}`}>
                      <span aria-hidden="true">{item?.emoji ?? "📦"}</span> {item?.title ?? inv.item_slug}
                      {isPlaced ? <X className="h-3.5 w-3.5" aria-hidden="true" /> : <Plus className="h-3.5 w-3.5" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Pets */}
          {pets.length > 0 && (
            <section className="mt-6">
              <h2 className="font-heading text-lg font-bold">{t("kids.world.myHome.pets")}</h2>
              <div className="mt-3 flex flex-wrap gap-3">
                {pets.map((p) => (
                  <span key={p.item_slug} className="grid h-14 w-14 place-items-center rounded-2xl border-2 border-border bg-card text-3xl" title={itemBySlug.get(p.item_slug)?.title ?? ""} aria-hidden="true">
                    {itemBySlug.get(p.item_slug)?.emoji ?? "🐾"}
                  </span>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
