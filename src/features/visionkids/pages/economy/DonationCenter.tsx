import { useState } from "react";
import { Heart, Coins } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useCoinBalance, useDonate } from "@/features/visionkids/hooks/economy/useEconomy";
import { DONATION_CAUSES, DONATION_AMOUNTS } from "@/features/visionkids/data/economyConfig";
import { EconomyHeader } from "@/features/visionkids/components/economy/EconomyShell";
import type { DonationCause } from "@/features/visionkids/types/economy.types";

export default function DonationCenter() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: balance = 0 } = useCoinBalance();
  const donate = useDonate();
  const [cause, setCause] = useState<DonationCause>("free_content");
  const [amount, setAmount] = useState(DONATION_AMOUNTS[1]);
  const [msg, setMsg] = useState<string | null>(null);

  useDocumentHead({ title: `${t("kids.economy.nav.donate")} — VisionKids`, description: t("kids.economy.donate.subtitle"), canonicalPath: "/kids/economy/donate" });

  async function give() {
    setMsg(null);
    try { await donate.mutateAsync({ cause, amount }); setMsg(t("kids.economy.donate.thanks")); setTimeout(() => setMsg(null), 3000); }
    catch (e) { setMsg(e instanceof Error ? e.message : t("kids.economy.donate.failed")); }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <EconomyHeader emoji="💛" title={t("kids.economy.nav.donate")} subtitle={t("kids.economy.donate.subtitle")} />
      {!user ? (
        <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.economy.signInHint")}</p>
      ) : (
        <>
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Coins className="h-4 w-4 text-kids-accent" aria-hidden="true" /> {t("kids.economy.donate.balance")}: {balance.toLocaleString()}</p>
          <fieldset className="mt-4">
            <legend className="text-sm font-semibold">{t("kids.economy.donate.chooseCause")}</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {DONATION_CAUSES.map((c) => (
                <button key={c.cause} type="button" onClick={() => setCause(c.cause)} aria-pressed={cause === c.cause}
                  className={`flex flex-col items-center gap-1 rounded-2xl border-2 p-4 transition-colors ${cause === c.cause ? "border-kids-primary bg-kids-primary/10 text-kids-primary" : "border-border hover:border-kids-primary/50"}`}>
                  <span className="text-3xl" aria-hidden="true">{c.emoji}</span>
                  <span className="text-sm font-semibold">{t(`kids.economy.cause.${c.cause}`)}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="mt-4">
            <legend className="text-sm font-semibold">{t("kids.economy.donate.amount")}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {DONATION_AMOUNTS.map((a) => (
                <button key={a} type="button" onClick={() => setAmount(a)} aria-pressed={amount === a}
                  className={`rounded-full border-2 px-4 py-1.5 text-sm font-bold transition-colors ${amount === a ? "border-kids-primary bg-kids-primary/10 text-kids-primary" : "border-border hover:border-kids-primary/50"}`}>
                  {a}
                </button>
              ))}
            </div>
          </fieldset>
          <button type="button" onClick={give} disabled={balance < amount || donate.isPending} className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-kids-pink px-6 py-2.5 font-bold text-white hover:opacity-90 disabled:opacity-50">
            <Heart className="h-4 w-4" aria-hidden="true" /> {t("kids.economy.donate.give")}
          </button>
          {msg && <p className="mt-3 text-sm font-semibold">{msg}</p>}
        </>
      )}
    </div>
  );
}
