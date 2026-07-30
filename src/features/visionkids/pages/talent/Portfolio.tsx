import { useState } from "react";
import { Trash2, Plus } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useMyPortfolio, useAddPortfolioItem, useRemovePortfolioItem } from "@/features/visionkids/hooks/talent/usePortfolio";
import { TalentHeader } from "@/features/visionkids/components/talent/TalentHeader";
import type { PortfolioKind } from "@/features/visionkids/types/talent.types";

const KINDS: { value: PortfolioKind; emoji: string }[] = [
  { value: "project", emoji: "🚀" },
  { value: "drawing", emoji: "🎨" },
  { value: "story", emoji: "📖" },
  { value: "game", emoji: "🎮" },
  { value: "other", emoji: "⭐" },
];

export default function Portfolio() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: items = [], isLoading } = useMyPortfolio();
  const add = useAddPortfolioItem();
  const remove = useRemovePortfolioItem();

  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<PortfolioKind>("project");

  useDocumentHead({
    title: `${t("kids.talent.nav.portfolio")} — VisionKids`,
    description: t("kids.talent.portfolio.subtitle"),
    canonicalPath: "/kids/talent/portfolio",
  });

  async function submit() {
    const clean = title.trim();
    if (!clean) return;
    const emoji = KINDS.find((k) => k.value === kind)?.emoji ?? "⭐";
    await add.mutateAsync({ kind, title: clean, emoji, source: "manual" });
    setTitle("");
    setAdding(false);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <TalentHeader emoji="📁" title={t("kids.talent.nav.portfolio")} subtitle={t("kids.talent.portfolio.subtitle")} showSubNav activeId="portfolio" />

      {user && (
        <div className="mt-5">
          {adding ? (
            <div className="rounded-2xl border-2 border-border bg-card p-4">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("kids.talent.portfolio.titlePlaceholder")}
                className="w-full rounded-xl border-2 border-border bg-background px-3 py-2"
                maxLength={80}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {KINDS.map((k) => (
                  <button
                    key={k.value}
                    type="button"
                    onClick={() => setKind(k.value)}
                    className={`rounded-full border-2 px-3 py-1 text-sm font-semibold ${kind === k.value ? "border-kids-primary bg-kids-primary/10 text-kids-primary" : "border-border"}`}
                  >
                    {k.emoji} {t(`kids.talent.portfolioKind.${k.value}`)}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={submit} disabled={!title.trim() || add.isPending} className="rounded-full bg-kids-primary px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50">
                  {t("kids.talent.portfolio.save")}
                </button>
                <button type="button" onClick={() => setAdding(false)} className="rounded-full border-2 border-border px-4 py-2 text-sm font-semibold">
                  {t("kids.talent.portfolio.cancel")}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-2 rounded-full bg-kids-primary px-5 py-2.5 font-bold text-white hover:opacity-90">
              <Plus className="h-4 w-4" aria-hidden="true" /> {t("kids.talent.portfolio.add")}
            </button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-6 rounded-2xl border-2 border-dashed border-border bg-card p-8 text-center text-muted-foreground">
          <p className="text-4xl" aria-hidden="true">📭</p>
          <p className="mt-2 font-heading text-lg font-bold text-foreground">{t("kids.talent.portfolio.empty")}</p>
          <p className="mt-1 text-sm">{t("kids.talent.portfolio.emptyHint")}</p>
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li key={item.id} className="relative flex flex-col gap-2 rounded-2xl border-2 border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <span className="text-3xl" aria-hidden="true">{item.emoji}</span>
                {user && (
                  <button type="button" onClick={() => remove.mutate(item.id)} aria-label={t("kids.talent.portfolio.remove")} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>
              <p className="font-heading font-bold leading-tight">{item.title}</p>
              {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
              <span className="mt-auto text-[11px] font-semibold uppercase tracking-wide text-kids-primary">{t(`kids.talent.portfolioKind.${item.kind}`)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
