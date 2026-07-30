import { useMemo, useState } from "react";
import { Lock, CheckCircle2, Circle, Sparkles, Coins } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useSkills, useMySkillProgress, useCompleteSkill } from "@/features/visionkids/hooks/talent/useSkills";
import { useTalentDomains } from "@/features/visionkids/hooks/talent/useTalentCatalog";
import { TalentHeader } from "@/features/visionkids/components/talent/TalentHeader";
import { RewardBanner } from "@/features/visionkids/components/talent/RewardBanner";
import type { Skill } from "@/features/visionkids/types/talent.types";

export default function SkillTree() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: skills = [], isLoading } = useSkills();
  const { data: progress = [] } = useMySkillProgress();
  const { data: domains = [] } = useTalentDomains();
  const complete = useCompleteSkill();

  const [openSkill, setOpenSkill] = useState<string | null>(null);
  const [reward, setReward] = useState<{ title: string; xp: number; coins: number } | null>(null);

  useDocumentHead({
    title: `${t("kids.talent.nav.skillTree")} — VisionKids`,
    description: t("kids.talent.skillTree.subtitle"),
    canonicalPath: "/kids/talent/skill-tree",
  });

  const completedSet = useMemo(
    () => new Set(progress.filter((p) => p.status === "completed").map((p) => p.skill_slug)),
    [progress],
  );

  const isUnlocked = (s: Skill) => s.prerequisites.every((pre) => completedSet.has(pre));
  const skillTitle = (slug: string) => skills.find((s) => s.slug === slug)?.title ?? slug;

  const byDomain = useMemo(() => {
    const map: Record<string, Skill[]> = {};
    for (const s of skills) (map[s.domain_slug] ??= []).push(s);
    return map;
  }, [skills]);

  async function master(s: Skill) {
    if (!isUnlocked(s) || completedSet.has(s.slug)) return;
    try {
      const fresh = await complete.mutateAsync(s.slug);
      if (fresh) {
        setReward({ title: s.title, xp: s.reward_xp, coins: s.reward_coins });
        setTimeout(() => setReward(null), 3500);
      }
      setOpenSkill(null);
    } catch {
      /* surfaced via disabled state; prereqs enforced server-side too */
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <TalentHeader emoji="🌳" title={t("kids.talent.nav.skillTree")} subtitle={t("kids.talent.skillTree.subtitle")} showSubNav activeId="skill-tree" />

      <RewardBanner show={!!reward} message={reward ? `${t("kids.talent.skillTree.mastered")} ${reward.title}!` : ""} xp={reward?.xp} coins={reward?.coins} />

      {!user && (
        <p className="mt-4 rounded-2xl border-2 border-dashed border-border bg-card p-3 text-sm text-muted-foreground" role="status">
          {t("kids.talent.skillTree.signInHint")}
        </p>
      )}

      {isLoading ? (
        <div className="mt-6 h-72 animate-pulse rounded-3xl bg-muted" aria-busy="true" />
      ) : (
        <div className="mt-6 space-y-8">
          {domains
            .filter((d) => byDomain[d.slug]?.length)
            .map((domain) => (
              <section key={domain.slug}>
                <h2 className="font-heading text-lg font-bold">
                  <span aria-hidden="true">{domain.emoji}</span> {domain.title}
                </h2>
                <ol className="mt-3 space-y-2">
                  {byDomain[domain.slug].map((s) => {
                    const done = completedSet.has(s.slug);
                    const unlocked = isUnlocked(s);
                    const open = openSkill === s.slug;
                    return (
                      <li key={s.slug} className={`rounded-2xl border-2 p-3 ${done ? "border-kids-green/40 bg-kids-green/5" : unlocked ? "border-border bg-card" : "border-border bg-muted/40"}`}>
                        <button
                          type="button"
                          onClick={() => setOpenSkill(open ? null : s.slug)}
                          className="flex w-full items-center gap-3 text-start"
                          aria-expanded={open}
                        >
                          <span className="text-2xl" aria-hidden="true">{s.emoji}</span>
                          <span className="flex-1">
                            <span className="flex items-center gap-2 font-heading font-bold">
                              {s.title}
                              {done ? <CheckCircle2 className="h-4 w-4 text-kids-green" aria-hidden="true" />
                                : !unlocked ? <Lock className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> : null}
                            </span>
                            <span className="text-xs text-muted-foreground">{s.description}</span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-0.5"><Sparkles className="h-3 w-3" aria-hidden="true" />{s.reward_xp}</span>
                            <span className="flex items-center gap-0.5"><Coins className="h-3 w-3" aria-hidden="true" />{s.reward_coins}</span>
                          </span>
                        </button>

                        {open && (
                          <div className="mt-3 border-t border-border pt-3">
                            {!unlocked && s.prerequisites.length > 0 && (
                              <p className="mb-2 text-sm text-muted-foreground">
                                🔒 {t("kids.talent.skillTree.needs")} {s.prerequisites.map(skillTitle).join("، ")}
                              </p>
                            )}
                            <ul className="space-y-1.5">
                              {s.tasks.map((task, i) => (
                                <li key={i} className="flex items-center gap-2 text-sm">
                                  {done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-kids-green" aria-hidden="true" /> : <Circle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
                                  {task}
                                </li>
                              ))}
                            </ul>
                            {!done && (
                              <button
                                type="button"
                                onClick={() => master(s)}
                                disabled={!unlocked || !user || complete.isPending}
                                className="mt-3 rounded-full bg-kids-primary px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
                              >
                                {t("kids.talent.skillTree.master")}
                              </button>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
        </div>
      )}
    </div>
  );
}
