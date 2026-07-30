import { ShieldCheck, Clock, XCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useMyCreatorProfile, useRequestVerification } from "@/features/visionkids/hooks/market/useMarketCreator";
import { MarketHeader } from "@/features/visionkids/components/market/MarketHeader";

export default function CreatorVerification() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: profile } = useMyCreatorProfile();
  const request = useRequestVerification();

  useDocumentHead({
    title: `${t("kids.market.nav.verification")} — VisionKids`,
    description: t("kids.market.verification.subtitle"),
    canonicalPath: "/kids/market/verification",
  });

  const status = profile?.verification_status ?? "none";

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <MarketHeader emoji="✅" title={t("kids.market.nav.verification")} subtitle={t("kids.market.verification.subtitle")} backTo="/kids/market/creator" backLabelKey="kids.market.nav.creatorDashboard" />

      {!user || !profile ? (
        <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.market.verification.needProfile")}</p>
      ) : profile.verified ? (
        <div className="mt-6 rounded-2xl border-2 border-kids-green/40 bg-kids-green/5 p-6 text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-kids-green" aria-hidden="true" />
          <p className="mt-2 font-heading text-xl font-bold text-kids-green">{t("kids.market.verification.verified")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("kids.market.verification.verifiedHint")}</p>
        </div>
      ) : status === "pending" ? (
        <div className="mt-6 rounded-2xl border-2 border-kids-accent/40 bg-kids-accent/5 p-6 text-center">
          <Clock className="mx-auto h-12 w-12 text-kids-accent" aria-hidden="true" />
          <p className="mt-2 font-heading text-xl font-bold">{t("kids.market.verification.pending")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("kids.market.verification.pendingHint")}</p>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border-2 border-border bg-card p-6">
          {status === "rejected" && (
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-kids-pink"><XCircle className="h-4 w-4" aria-hidden="true" /> {t("kids.market.verification.rejected")}</p>
          )}
          <h2 className="font-heading text-lg font-bold">{t("kids.market.verification.title")}</h2>
          <ul className="mt-3 list-disc space-y-1 ps-5 text-sm text-muted-foreground">
            <li>{t("kids.market.verification.point1")}</li>
            <li>{t("kids.market.verification.point2")}</li>
            <li>{t("kids.market.verification.point3")}</li>
          </ul>
          <button type="button" onClick={() => request.mutate()} disabled={request.isPending}
            className="mt-4 rounded-full bg-kids-primary px-6 py-2.5 font-bold text-white hover:opacity-90 disabled:opacity-50">
            {t("kids.market.verification.request")}
          </button>
        </div>
      )}
    </div>
  );
}
