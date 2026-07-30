import { useState } from "react";
import { Link } from "react-router-dom";
import { Users, KeyRound, Clock, Trophy, Sparkles, Award, Copy, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import {
  useMyChildren, useUnlinkChild, useGenerateParentLinkCode, useRedeemParentLinkCode, useChildWeeklySummary,
} from "@/features/visionkids/hooks/academy/useAcademyParent";
import type { ParentChildLink } from "@/features/visionkids/types/academy.types";

function ChildSummaryCard({ link, onUnlink }: { link: ParentChildLink; onUnlink: (id: string) => void }) {
  const { t } = useLanguage();
  const { data: summary, isLoading } = useChildWeeklySummary(link.child_user_id);

  return (
    <div className="rounded-2xl border-2 border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="font-heading font-bold">{t("kids.academy.childAccount")}</p>
        <Button variant="ghost" size="icon" onClick={() => onUnlink(link.id)} aria-label={t("kids.academy.unlink")}>
          <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
        </Button>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{t("kids.academy.weeklyReport")}</p>
      {isLoading ? (
        <div className="h-16 animate-pulse rounded-lg bg-muted" aria-busy="true" />
      ) : (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-1.5"><Trophy className="h-4 w-4 text-kids-accent" aria-hidden="true" /> {summary?.lessonsCompleted ?? 0} {t("kids.academy.lessons")}</div>
          <div className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-kids-secondary" aria-hidden="true" /> {summary?.totalMinutes ?? 0}m</div>
          <div className="flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-kids-primary" aria-hidden="true" /> {summary?.averageScore ?? "—"}%</div>
          <div className="flex items-center gap-1.5"><Award className="h-4 w-4 text-kids-purple" aria-hidden="true" /> {summary?.achievementsEarned ?? 0} {t("kids.academy.achievements")}</div>
        </div>
      )}
    </div>
  );
}

export default function ParentsDashboard() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: children = [], isLoading } = useMyChildren();
  const unlinkChild = useUnlinkChild();
  const generateCode = useGenerateParentLinkCode();
  const redeemCode = useRedeemParentLinkCode();
  const [myCode, setMyCode] = useState<string | null>(null);
  const [redeemInput, setRedeemInput] = useState("");
  const [redeemError, setRedeemError] = useState<string | null>(null);

  useDocumentHead({ title: t("kids.academy.parentsDashboardTitle"), description: t("kids.academy.meta.description"), canonicalPath: "/kids/academy/parents" });

  const handleGenerate = async () => setMyCode(await generateCode.mutateAsync());

  const handleRedeem = async () => {
    setRedeemError(null);
    const ok = await redeemCode.mutateAsync(redeemInput.trim());
    if (!ok) setRedeemError(t("kids.academy.linkCodeInvalid"));
    else setRedeemInput("");
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-semibold">{t("kids.stories.signInRequired")}</p>
        <Link to="/login" className="mt-2 inline-block text-kids-primary hover:underline">{t("nav.login")}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold">
        <Users className="h-7 w-7 text-kids-primary" aria-hidden="true" /> {t("kids.academy.parentsDashboardTitle")}
      </h1>
      <p className="mt-1 text-muted-foreground">{t("kids.academy.parentsDashboardSubtitle")}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border-2 border-border bg-card p-4">
          <p className="mb-2 flex items-center gap-1.5 font-semibold"><KeyRound className="h-4 w-4 text-kids-secondary" aria-hidden="true" /> {t("kids.academy.linkAsParent")}</p>
          <p className="mb-3 text-sm text-muted-foreground">{t("kids.academy.linkAsParentDesc")}</p>
          <div className="flex gap-2">
            <Input value={redeemInput} onChange={(e) => setRedeemInput(e.target.value.toUpperCase())} placeholder={t("kids.academy.enterChildCode")} maxLength={6} />
            <Button onClick={handleRedeem} disabled={!redeemInput.trim() || redeemCode.isPending} className="bg-kids-primary text-white hover:bg-kids-primary/90">{t("kids.games.join")}</Button>
          </div>
          {redeemError && <p className="mt-2 text-sm text-destructive" role="alert">{redeemError}</p>}
        </div>

        <div className="rounded-2xl border-2 border-border bg-card p-4">
          <p className="mb-2 flex items-center gap-1.5 font-semibold"><KeyRound className="h-4 w-4 text-kids-accent" aria-hidden="true" /> {t("kids.academy.generateChildCode")}</p>
          <p className="mb-3 text-sm text-muted-foreground">{t("kids.academy.generateChildCodeDesc")}</p>
          {myCode ? (
            <button type="button" onClick={() => navigator.clipboard?.writeText(myCode)} className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 font-mono text-lg font-bold">
              {myCode} <Copy className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : (
            <Button variant="outline" onClick={handleGenerate} disabled={generateCode.isPending} className="gap-1.5">
              {generateCode.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} {t("kids.academy.generateCode")}
            </Button>
          )}
        </div>
      </div>

      <h2 className="mt-8 font-heading text-lg font-bold">{t("kids.academy.myChildren")}</h2>
      {isLoading ? (
        <div className="mt-3 flex flex-col gap-2" aria-busy="true">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : children.length === 0 ? (
        <p className="mt-3 text-muted-foreground">{t("kids.academy.noChildrenLinked")}</p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {children.map((link) => <ChildSummaryCard key={link.id} link={link} onUnlink={(id) => unlinkChild.mutate(id)} />)}
        </div>
      )}
    </div>
  );
}
