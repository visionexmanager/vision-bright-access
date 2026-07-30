import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useInvoices } from "@/features/visionkids/hooks/economy/useEconomy";
import { EconomyHeader } from "@/features/visionkids/components/economy/EconomyShell";

export default function Invoices() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: invoices = [], isLoading } = useInvoices();

  useDocumentHead({ title: `${t("kids.economy.nav.invoices")} — VisionKids`, description: t("kids.economy.invoices.subtitle"), canonicalPath: "/kids/economy/invoices" });

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <EconomyHeader emoji="🧾" title={t("kids.economy.nav.invoices")} subtitle={t("kids.economy.invoices.subtitle")} />
      {!user ? (
        <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.economy.signInHint")}</p>
      ) : isLoading ? (
        <div className="mt-6 flex flex-col gap-2" aria-busy="true">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : invoices.length === 0 ? (
        <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.economy.invoices.empty")}</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {invoices.map((inv) => (
            <li key={inv.id} className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-4">
              <span className="text-2xl" aria-hidden="true">🧾</span>
              <div className="min-w-0 flex-1">
                <p className="font-heading font-bold">${inv.amount_usd}</p>
                <p className="text-xs text-muted-foreground">{new Date(inv.issued_at).toLocaleDateString()}</p>
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase">{t(`kids.economy.invoiceStatus.${inv.status}`)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
