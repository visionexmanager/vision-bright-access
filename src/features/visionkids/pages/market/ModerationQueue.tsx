import { Check, X, AlertTriangle, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useModerationQueue, usePendingVerifications, useModerateProduct, useVerifyCreator } from "@/features/visionkids/hooks/market/useMarketModeration";
import { PRODUCT_TYPE_META } from "@/features/visionkids/data/marketConfig";
import { MarketHeader } from "@/features/visionkids/components/market/MarketHeader";

export default function ModerationQueue() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: queue = [], isLoading } = useModerationQueue();
  const { data: verifications = [] } = usePendingVerifications();
  const moderate = useModerateProduct();
  const verify = useVerifyCreator();

  useDocumentHead({
    title: `${t("kids.market.nav.moderation")} — VisionKids`,
    description: t("kids.market.moderation.subtitle"),
    canonicalPath: "/kids/market/moderation",
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <MarketHeader emoji="🛡️" title={t("kids.market.nav.moderation")} subtitle={t("kids.market.moderation.subtitle")} />

      {!user ? (
        <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.market.signInHint")}</p>
      ) : (
        <>
          <p className="mt-4 rounded-xl border-2 border-dashed border-border bg-card p-3 text-xs text-muted-foreground">🔒 {t("kids.market.moderation.modsOnly")}</p>

          {/* Product review queue */}
          <section className="mt-6">
            <h2 className="font-heading text-xl font-bold">{t("kids.market.moderation.productQueue")}</h2>
            {isLoading ? (
              <div className="mt-3 h-24 animate-pulse rounded-2xl bg-muted" aria-busy="true" />
            ) : queue.length === 0 ? (
              <p className="mt-3 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.market.moderation.queueEmpty")}</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-3">
                {queue.map(({ product, moderation }) => {
                  const meta = PRODUCT_TYPE_META[product.type];
                  const flags = moderation?.auto_flags ?? [];
                  return (
                    <li key={product.id} className="rounded-2xl border-2 border-border bg-card p-4">
                      <div className="flex items-start gap-3">
                        <span className="text-3xl" aria-hidden="true">{product.emoji}</span>
                        <div className="min-w-0 flex-1">
                          <p className="font-heading font-bold leading-tight">{product.title}</p>
                          <p className="text-xs text-muted-foreground">{meta ? t(meta.labelKey) : product.type} · {t("kids.market.ages")} {product.age_min}–{product.age_max}</p>
                          {product.description && <p className="mt-1 line-clamp-2 text-sm text-foreground/70">{product.description}</p>}
                          {moderation && (
                            <p className={`mt-1 flex items-center gap-1 text-xs font-semibold ${moderation.auto_status === "flagged" ? "text-kids-pink" : "text-kids-green"}`}>
                              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                              {t("kids.market.moderation.autoReview")}: {t(`kids.market.moderation.auto.${moderation.auto_status}`)}
                              {flags.length > 0 && ` — ${flags.join(", ")}`}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button type="button" onClick={() => moderate.mutate({ productId: product.id, approve: true })} disabled={moderate.isPending}
                          className="inline-flex items-center gap-1 rounded-full bg-kids-green px-4 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50">
                          <Check className="h-3.5 w-3.5" aria-hidden="true" /> {t("kids.market.moderation.approve")}
                        </button>
                        <button type="button" onClick={() => moderate.mutate({ productId: product.id, approve: false })} disabled={moderate.isPending}
                          className="inline-flex items-center gap-1 rounded-full bg-kids-pink px-4 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50">
                          <X className="h-3.5 w-3.5" aria-hidden="true" /> {t("kids.market.moderation.reject")}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Verification requests */}
          <section className="mt-8">
            <h2 className="font-heading text-xl font-bold">{t("kids.market.moderation.verifyQueue")}</h2>
            {verifications.length === 0 ? (
              <p className="mt-3 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.market.moderation.verifyEmpty")}</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {verifications.map((c) => (
                  <li key={c.user_id} className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-4">
                    <span className="text-2xl" aria-hidden="true">{c.avatar}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-heading font-bold">{c.display_name}</p>
                      <p className="text-xs text-muted-foreground">{t(`kids.market.role.${c.kind}`)}</p>
                    </div>
                    <button type="button" onClick={() => verify.mutate({ userId: c.user_id, approve: true })} disabled={verify.isPending}
                      className="inline-flex items-center gap-1 rounded-full bg-kids-primary px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50">
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> {t("kids.market.moderation.verify")}
                    </button>
                    <button type="button" onClick={() => verify.mutate({ userId: c.user_id, approve: false })} disabled={verify.isPending}
                      className="rounded-full p-2 text-kids-pink hover:bg-kids-pink/10" title={t("kids.market.moderation.reject")}>
                      <X className="h-4 w-4" aria-label={t("kids.market.moderation.reject")} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
