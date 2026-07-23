import { useState } from "react";
import { Trophy, Plus } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { ChallengeCard } from "@/components/library/ChallengeCard";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { EmptyState } from "@/components/library/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useReadingChallenges } from "@/hooks/library/useReadingChallenges";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import type { LibraryChallengeGoalType, LibraryChallengeCadence } from "@/lib/types/library-home";

const GOAL_TYPES: LibraryChallengeGoalType[] = ["books_count", "pages_count", "minutes_read"];
const CADENCES: LibraryChallengeCadence[] = ["daily", "weekly", "monthly", "yearly", "custom"];

export default function LibraryChallenges() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { challenges, isLoading, create, join } = useReadingChallenges();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [goalType, setGoalType] = useState<LibraryChallengeGoalType>("books_count");
  const [goalTarget, setGoalTarget] = useState("10");
  const [cadence, setCadence] = useState<LibraryChallengeCadence>("monthly");
  const [scope, setScope] = useState<"community" | "custom">("custom");

  useDocumentHead({ title: t("library.challenge.pageTitle") });

  const adminChallenges = challenges.filter((c) => c.scope === "admin");
  const communityChallenges = challenges.filter((c) => c.scope !== "admin");

  return (
    <Layout>
      <LibraryLayout
        title={t("library.challenge.pageTitle")}
        breadcrumb={[{ label: t("library.challenge.pageTitle") }]}
        headerActions={
          user && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" aria-hidden="true" /> {t("library.challenge.create")}</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{t("library.challenge.create")}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label htmlFor="ch-title">{t("library.discussions.titleLabel")}</Label><Input id="ch-title" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
                  <div><Label htmlFor="ch-desc">{t("library.clubs.descriptionLabel")}</Label><Textarea id="ch-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>{t("library.challenge.goalType")}</Label>
                      <Select value={goalType} onValueChange={(v) => setGoalType(v as LibraryChallengeGoalType)}>
                        <SelectTrigger aria-label={t("library.challenge.goalType")}><SelectValue /></SelectTrigger>
                        <SelectContent>{GOAL_TYPES.map((g) => <SelectItem key={g} value={g}>{t(`library.challenge.unit.${g === "books_count" ? "books" : g === "pages_count" ? "pages" : "minutes"}`)}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label htmlFor="ch-target">{t("library.goals.targetLabel")}</Label><Input id="ch-target" type="number" min={1} value={goalTarget} onChange={(e) => setGoalTarget(e.target.value)} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>{t("library.challenge.cadence")}</Label>
                      <Select value={cadence} onValueChange={(v) => setCadence(v as LibraryChallengeCadence)}>
                        <SelectTrigger aria-label={t("library.challenge.cadence")}><SelectValue /></SelectTrigger>
                        <SelectContent>{CADENCES.map((c) => <SelectItem key={c} value={c}>{t(`library.challenge.cadence.${c}`)}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>{t("library.challenge.scope")}</Label>
                      <Select value={scope} onValueChange={(v) => setScope(v as "community" | "custom")}>
                        <SelectTrigger aria-label={t("library.challenge.scope")}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="custom">{t("library.challenge.scope.custom")}</SelectItem>
                          <SelectItem value="community">{t("library.challenge.scope.community")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    disabled={!title.trim()}
                    onClick={async () => {
                      await create({ title: title.trim(), description: description.trim() || null, goal_type: goalType, goal_target: Number(goalTarget) || 1, cadence, scope, category_id: null, ends_at: null });
                      setOpen(false);
                      setTitle("");
                      setDescription("");
                    }}
                  >
                    {t("library.clubs.create")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )
        }
      >
        {isLoading ? (
          <SkeletonLoader variant="grid" />
        ) : (
          <div className="space-y-8">
            {adminChallenges.length > 0 && (
              <section>
                <h2 className="mb-3 text-lg font-semibold">{t("library.challenge.featured")}</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {adminChallenges.map((c) => <ChallengeCard key={c.id} challenge={c} />)}
                </div>
              </section>
            )}
            <section>
              <h2 className="mb-3 text-lg font-semibold">{t("library.challenge.communityAndCustom")}</h2>
              {communityChallenges.length === 0 ? (
                <EmptyState icon={<Trophy className="h-8 w-8" />} title={t("library.challenge.empty")} className="py-8" />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {communityChallenges.map((c) => <ChallengeCard key={c.id} challenge={c} onJoin={() => void join(c.id)} />)}
                </div>
              )}
            </section>
          </div>
        )}
      </LibraryLayout>
    </Layout>
  );
}
