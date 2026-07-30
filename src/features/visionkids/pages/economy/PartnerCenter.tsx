import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { usePartners } from "@/features/visionkids/hooks/economy/useEconomy";
import { EconomyHeader } from "@/features/visionkids/components/economy/EconomyShell";

export default function PartnerCenter() {
  const { t } = useLanguage();
  const { data: partners = [], isLoading } = usePartners();

  useDocumentHead({ title: `${t("kids.economy.nav.partners")} — VisionKids`, description: t("kids.economy.partners.subtitle"), canonicalPath: "/kids/economy/partners" });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <EconomyHeader emoji="🤝" title={t("kids.economy.nav.partners")} subtitle={t("kids.economy.partners.subtitle")} />
      {isLoading ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : partners.length === 0 ? (
        <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.economy.partners.empty")}</p>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {partners.map((p) => (
            <div key={p.slug} className="flex flex-col gap-1 rounded-2xl border-2 border-border bg-card p-4">
              <span className="text-3xl" aria-hidden="true">{p.emoji}</span>
              <p className="font-heading font-bold leading-tight">{p.name}</p>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t(`kids.economy.partnerKind.${p.kind}`)}</span>
              {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
