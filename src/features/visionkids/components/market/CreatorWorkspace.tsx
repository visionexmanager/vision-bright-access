import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Send, Trash2, BarChart3, ShieldCheck, Coins, Download } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import {
  useMyCreatorProfile, useUpsertCreatorProfile, useMyProducts, useCreatorStats,
  useCreateProduct, useSubmitProduct, useDeleteProduct,
} from "@/features/visionkids/hooks/market/useMarketCreator";
import { PRODUCT_TYPES, PRODUCT_LEVELS, LICENSE_KINDS, STATUS_BADGE, MARKET_COLOR_CLASSES } from "@/features/visionkids/data/marketConfig";
import { MarketHeader } from "@/features/visionkids/components/market/MarketHeader";
import type { CreatorKind, ProductType, ProductLevel, LicenseKind } from "@/features/visionkids/types/market.types";

function slugify(title: string): string {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "product";
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Shared dashboard for every seller role (creator/teacher/publisher/developer).
 *  Onboards a profile, shows stats, and manages products — all over the one
 *  polymorphic products catalog. Role only changes the default profile kind,
 *  the offered content types, and the page copy. */
export function CreatorWorkspace({
  kind,
  allowedTypes,
  emoji,
  titleKey,
  subtitleKey,
  canonicalPath,
}: {
  kind: CreatorKind;
  allowedTypes: ProductType[];
  emoji: string;
  titleKey: string;
  subtitleKey: string;
  canonicalPath: string;
}) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: profile, isLoading } = useMyCreatorProfile();
  const upsertProfile = useUpsertCreatorProfile();
  const { data: products = [] } = useMyProducts();
  const { data: stats } = useCreatorStats();
  const createProduct = useCreateProduct();
  const submitProduct = useSubmitProduct();
  const deleteProduct = useDeleteProduct();

  // Onboarding form
  const [displayName, setDisplayName] = useState("");
  // New product form
  const [showForm, setShowForm] = useState(false);
  const [pType, setPType] = useState<ProductType>(allowedTypes[0]);
  const [pTitle, setPTitle] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [pLevel, setPLevel] = useState<ProductLevel>("all");
  const [pPrice, setPPrice] = useState(0);
  const [pLicense, setPLicense] = useState<LicenseKind>("standard");
  const [pAgeMin, setPAgeMin] = useState(3);
  const [pAgeMax, setPAgeMax] = useState(12);
  const [msg, setMsg] = useState<string | null>(null);

  useDocumentHead({ title: `${t(titleKey)} — VisionKids`, description: t(subtitleKey), canonicalPath });

  async function onboard() {
    if (!displayName.trim()) return;
    await upsertProfile.mutateAsync({ display_name: displayName.trim(), kind }).catch(() => {});
  }

  async function onCreate() {
    if (!pTitle.trim()) return;
    setMsg(null);
    try {
      await createProduct.mutateAsync({
        type: pType, title: pTitle.trim(), slug: slugify(pTitle),
        description: pDesc.trim() || undefined, level: pLevel, price_coins: Math.max(0, pPrice),
        license: pLicense, age_min: pAgeMin, age_max: pAgeMax, category: "literacy",
      });
      setShowForm(false);
      setPTitle(""); setPDesc(""); setPPrice(0);
      setMsg(t("kids.market.dash.created"));
      setTimeout(() => setMsg(null), 2800);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : t("kids.market.dash.createFailed"));
    }
  }

  async function onSubmit(id: string) {
    setMsg(null);
    try {
      const res = await submitProduct.mutateAsync(id);
      setMsg(res.auto_status === "flagged" ? t("kids.market.dash.submittedFlagged") : t("kids.market.dash.submitted"));
      setTimeout(() => setMsg(null), 3500);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : t("kids.market.dash.submitFailed"));
    }
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <MarketHeader emoji={emoji} title={t(titleKey)} subtitle={t(subtitleKey)} />
        <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.market.dash.signInHint")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <MarketHeader emoji={emoji} title={t(titleKey)} subtitle={t(subtitleKey)} />

      {msg && <p className="mt-4 rounded-xl border-2 border-border bg-card p-3 text-sm font-semibold" role="status">{msg}</p>}

      {isLoading ? (
        <div className="mt-6 h-40 animate-pulse rounded-3xl bg-muted" aria-busy="true" />
      ) : !profile ? (
        /* Onboarding */
        <div className="mt-6 rounded-2xl border-2 border-border bg-card p-5">
          <h2 className="font-heading text-lg font-bold">{t("kids.market.dash.setupTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("kids.market.dash.setupHint")}</p>
          <label className="mt-3 block text-sm font-semibold">
            {t("kids.market.dash.displayName")}
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60}
              className="mt-1 w-full rounded-xl border-2 border-border bg-background px-3 py-2" />
          </label>
          <button type="button" onClick={onboard} disabled={!displayName.trim() || upsertProfile.isPending}
            className="mt-3 rounded-full bg-kids-primary px-5 py-2 font-bold text-white hover:opacity-90 disabled:opacity-50">
            {t("kids.market.dash.createProfile")}
          </button>
        </div>
      ) : (
        <>
          {/* Verification + links */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5 rounded-full border-2 border-border bg-card px-3 py-1.5 text-sm font-semibold">
              <span aria-hidden="true">{profile.avatar}</span> {profile.display_name}
              {profile.verified && <ShieldCheck className="h-4 w-4 text-kids-primary" aria-label={t("kids.market.verified")} />}
            </span>
            <Link to="/kids/market/analytics" className="inline-flex items-center gap-1.5 rounded-full border-2 border-border px-3 py-1.5 text-sm font-semibold hover:border-kids-primary/50">
              <BarChart3 className="h-4 w-4" aria-hidden="true" /> {t("kids.market.nav.analytics")}
            </Link>
            {!profile.verified && (
              <Link to="/kids/market/verification" className="inline-flex items-center gap-1.5 rounded-full border-2 border-border px-3 py-1.5 text-sm font-semibold hover:border-kids-primary/50">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" /> {t("kids.market.nav.verification")}
              </Link>
            )}
          </div>

          {/* Stats */}
          {stats && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: t("kids.market.status.published"), value: stats.published },
                { label: t("kids.market.status.pending"), value: stats.pending },
                { label: t("kids.market.dash.downloads"), value: stats.downloads, icon: Download },
                { label: t("kids.market.dash.earnings"), value: stats.earnings, icon: Coins },
              ].map((tile) => (
                <div key={tile.label} className="rounded-2xl border-2 border-border bg-card p-4 text-center">
                  <p className="font-heading text-2xl font-extrabold">{tile.value.toLocaleString?.() ?? tile.value}</p>
                  <p className="text-xs font-semibold text-muted-foreground">{tile.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* New product */}
          <div className="mt-6 flex items-center justify-between">
            <h2 className="font-heading text-xl font-bold">{t("kids.market.dash.myProducts")}</h2>
            <button type="button" onClick={() => setShowForm((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full bg-kids-primary px-4 py-2 text-sm font-bold text-white hover:opacity-90">
              <Plus className="h-4 w-4" aria-hidden="true" /> {t("kids.market.dash.newProduct")}
            </button>
          </div>

          {showForm && (
            <div className="mt-3 rounded-2xl border-2 border-border bg-card p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold">{t("kids.market.dash.type")}
                  <select value={pType} onChange={(e) => setPType(e.target.value as ProductType)} className="mt-1 w-full rounded-xl border-2 border-border bg-background px-3 py-2">
                    {allowedTypes.map((ty) => <option key={ty} value={ty}>{t(`kids.market.type.${ty}`)}</option>)}
                  </select>
                </label>
                <label className="text-sm font-semibold">{t("kids.market.dash.title")}
                  <input value={pTitle} onChange={(e) => setPTitle(e.target.value)} maxLength={80} className="mt-1 w-full rounded-xl border-2 border-border bg-background px-3 py-2" />
                </label>
                <label className="text-sm font-semibold sm:col-span-2">{t("kids.market.dash.description")}
                  <textarea value={pDesc} onChange={(e) => setPDesc(e.target.value)} rows={2} maxLength={500} className="mt-1 w-full rounded-xl border-2 border-border bg-background px-3 py-2" />
                </label>
                <label className="text-sm font-semibold">{t("kids.market.dash.level")}
                  <select value={pLevel} onChange={(e) => setPLevel(e.target.value as ProductLevel)} className="mt-1 w-full rounded-xl border-2 border-border bg-background px-3 py-2">
                    {PRODUCT_LEVELS.map((l) => <option key={l} value={l}>{t(`kids.market.level.${l}`)}</option>)}
                  </select>
                </label>
                <label className="text-sm font-semibold">{t("kids.market.dash.license")}
                  <select value={pLicense} onChange={(e) => setPLicense(e.target.value as LicenseKind)} className="mt-1 w-full rounded-xl border-2 border-border bg-background px-3 py-2">
                    {LICENSE_KINDS.map((l) => <option key={l} value={l}>{t(`kids.market.license.${l}`)}</option>)}
                  </select>
                </label>
                <label className="text-sm font-semibold">{t("kids.market.dash.priceCoins")}
                  <input type="number" min={0} value={pPrice} onChange={(e) => setPPrice(Number(e.target.value))} className="mt-1 w-full rounded-xl border-2 border-border bg-background px-3 py-2" />
                </label>
                <div className="flex gap-2">
                  <label className="flex-1 text-sm font-semibold">{t("kids.market.dash.ageMin")}
                    <input type="number" min={0} max={18} value={pAgeMin} onChange={(e) => setPAgeMin(Number(e.target.value))} className="mt-1 w-full rounded-xl border-2 border-border bg-background px-3 py-2" />
                  </label>
                  <label className="flex-1 text-sm font-semibold">{t("kids.market.dash.ageMax")}
                    <input type="number" min={0} max={18} value={pAgeMax} onChange={(e) => setPAgeMax(Number(e.target.value))} className="mt-1 w-full rounded-xl border-2 border-border bg-background px-3 py-2" />
                  </label>
                </div>
              </div>
              <button type="button" onClick={onCreate} disabled={!pTitle.trim() || createProduct.isPending}
                className="mt-3 rounded-full bg-kids-primary px-5 py-2 font-bold text-white hover:opacity-90 disabled:opacity-50">
                {t("kids.market.dash.saveDraft")}
              </button>
              <p className="mt-2 text-xs text-muted-foreground">🔒 {t("kids.market.dash.reviewNote")}</p>
            </div>
          )}

          {/* Product list */}
          {products.length === 0 ? (
            <p className="mt-4 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.market.dash.noProducts")}</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {products.map((p) => {
                const badge = STATUS_BADGE[p.status];
                return (
                  <li key={p.id} className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-4">
                    <span className="text-3xl" aria-hidden="true">{p.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-heading font-bold leading-tight">{p.title}</p>
                      <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${MARKET_COLOR_CLASSES[badge.color]}`}>{t(badge.labelKey)}</span>
                    </div>
                    {(p.status === "draft" || p.status === "rejected") && (
                      <button type="button" onClick={() => onSubmit(p.id)} disabled={submitProduct.isPending}
                        className="inline-flex items-center gap-1 rounded-full bg-kids-primary px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50">
                        <Send className="h-3.5 w-3.5" aria-hidden="true" /> {t("kids.market.dash.submit")}
                      </button>
                    )}
                    <button type="button" onClick={() => deleteProduct.mutate(p.id)} disabled={deleteProduct.isPending}
                      className="rounded-full p-2 text-kids-pink hover:bg-kids-pink/10" title={t("kids.market.dash.delete")}>
                      <Trash2 className="h-4 w-4" aria-label={t("kids.market.dash.delete")} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
