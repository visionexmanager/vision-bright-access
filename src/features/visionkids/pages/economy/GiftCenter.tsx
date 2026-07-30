import { useState } from "react";
import { Gift as GiftIcon, Send } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useGifts, useCreateGift, useClaimGift } from "@/features/visionkids/hooks/economy/useEconomy";
import { GIFT_KINDS } from "@/features/visionkids/data/economyConfig";
import { EconomyHeader } from "@/features/visionkids/components/economy/EconomyShell";
import type { GiftKind } from "@/features/visionkids/types/economy.types";

export default function GiftCenter() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: gifts } = useGifts();
  const createGift = useCreateGift();
  const claimGift = useClaimGift();

  const [toId, setToId] = useState("");
  const [kind, setKind] = useState<GiftKind>("coins");
  const [amount, setAmount] = useState(100);
  const [refSlug, setRefSlug] = useState("");
  const [message, setMessage] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useDocumentHead({ title: `${t("kids.economy.nav.gifts")} — VisionKids`, description: t("kids.economy.gifts.subtitle"), canonicalPath: "/kids/economy/gifts" });

  async function send() {
    if (!toId.trim()) return;
    setMsg(null);
    try {
      await createGift.mutateAsync({ toId: toId.trim(), kind, amount: kind === "coins" ? amount : 0, refSlug: refSlug.trim() || undefined, message: message.trim() || undefined });
      setToId(""); setMessage(""); setRefSlug("");
      setMsg(t("kids.economy.gifts.sent"));
      setTimeout(() => setMsg(null), 3000);
    } catch (e) { setMsg(e instanceof Error ? e.message : t("kids.economy.gifts.failed")); }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <EconomyHeader emoji="💝" title={t("kids.economy.nav.gifts")} subtitle={t("kids.economy.gifts.subtitle")} />
      <p className="mt-3 rounded-xl border-2 border-dashed border-border bg-card p-3 text-xs text-muted-foreground">💛 {t("kids.economy.gifts.parentNote")}</p>

      {!user ? (
        <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.economy.signInHint")}</p>
      ) : (
        <>
          <section className="mt-6 rounded-2xl border-2 border-border bg-card p-5">
            <h2 className="font-heading text-lg font-bold">{t("kids.economy.gifts.give")}</h2>
            <div className="mt-3 flex flex-col gap-2">
              <input value={toId} onChange={(e) => setToId(e.target.value)} placeholder={t("kids.economy.gifts.recipientId")} className="rounded-xl border-2 border-border bg-background px-3 py-2 text-sm" />
              <div className="flex flex-wrap gap-2">
                <select value={kind} onChange={(e) => setKind(e.target.value as GiftKind)} className="rounded-xl border-2 border-border bg-background px-3 py-2 text-sm">
                  {GIFT_KINDS.map((g) => <option key={g.kind} value={g.kind}>{g.emoji} {t(`kids.economy.giftKind.${g.kind}`)}</option>)}
                </select>
                {kind === "coins" ? (
                  <input type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="w-28 rounded-xl border-2 border-border bg-background px-3 py-2 text-sm" aria-label={t("kids.economy.coins")} />
                ) : (
                  <input value={refSlug} onChange={(e) => setRefSlug(e.target.value)} placeholder={t("kids.economy.gifts.itemSlug")} className="min-w-0 flex-1 rounded-xl border-2 border-border bg-background px-3 py-2 text-sm" />
                )}
              </div>
              <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t("kids.economy.gifts.message")} className="rounded-xl border-2 border-border bg-background px-3 py-2 text-sm" />
              <button type="button" onClick={send} disabled={!toId.trim() || createGift.isPending} className="inline-flex items-center gap-1.5 self-start rounded-full bg-kids-primary px-5 py-2 font-bold text-white hover:opacity-90 disabled:opacity-50">
                <Send className="h-4 w-4" aria-hidden="true" /> {t("kids.economy.gifts.send")}
              </button>
              {msg && <p className="text-sm font-semibold">{msg}</p>}
            </div>
          </section>

          <section className="mt-8">
            <h2 className="font-heading text-lg font-bold">{t("kids.economy.gifts.received")}</h2>
            {(gifts?.received.length ?? 0) === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">{t("kids.economy.gifts.noneReceived")}</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {gifts!.received.map((g) => (
                  <li key={g.id} className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-4">
                    <GiftIcon className="h-6 w-6 shrink-0 text-kids-pink" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="font-heading font-bold leading-tight">{t(`kids.economy.giftKind.${g.kind}`)}{g.kind === "coins" ? ` · ${g.amount}` : ""}</p>
                      {g.message && <p className="text-xs text-muted-foreground">"{g.message}"</p>}
                    </div>
                    {g.status === "pending" ? (
                      <button type="button" onClick={() => claimGift.mutate(g.id)} disabled={claimGift.isPending} className="rounded-full bg-kids-primary px-4 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50">{t("kids.economy.gifts.claim")}</button>
                    ) : (
                      <span className="text-xs font-semibold text-kids-green">{t("kids.economy.gifts.claimed")}</span>
                    )}
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
