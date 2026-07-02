import type { ReactNode } from "react";
import { MapPin, Briefcase, GraduationCap, Folder, Award, Languages, Trophy, MessageSquareQuote, Sparkles, Users } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNetwork } from "@/contexts/NetworkContext";
import { Button } from "@/components/ui/button";
import { CompanyAvatar } from "@/components/career/jobs/CompanyAvatar";
import { useAiSimulation } from "@/components/career/ai/useAiSimulation";
import { AIThinkingIndicator } from "@/components/career/ai/AIThinkingIndicator";
import { MOCK_PROFESSIONAL_PROFILE, MOCK_RECOMMENDATIONS } from "../mock/mockProfile";

function optimizeProfile(): string[] {
  const p = MOCK_PROFESSIONAL_PROFILE;
  const tips: string[] = [];
  if (p.skills.length < 8) tips.push("Add more skills — profiles with 8+ skills get significantly more views.");
  if (p.projects.length < 3) tips.push("Add one more project to strengthen your portfolio section.");
  if (!p.headline.toLowerCase().includes("ai") && !p.headline.toLowerCase().includes("lead")) tips.push("Consider highlighting a specialization or seniority signal in your headline.");
  tips.push("Ask a recent collaborator for a recommendation — profiles with 3+ recommendations rank higher in search.");
  return tips.slice(0, 3);
}

function InfoCard({ icon: Icon, title, children }: { icon: typeof Briefcase; title: string; children: ReactNode }) {
  return (
    <div className="net-glass rounded-2xl p-5">
      <p className="mb-3 flex items-center gap-1.5 text-sm font-bold"><Icon className="h-4 w-4 text-primary" aria-hidden="true" />{title}</p>
      {children}
    </div>
  );
}

export function ProfilePanel() {
  const { t } = useLanguage();
  const { setActiveSection } = useNetwork();
  const p = MOCK_PROFESSIONAL_PROFILE;
  const optimizer = useAiSimulation(optimizeProfile, 1300);

  return (
    <div className="flex flex-col gap-6">
      <div className="net-glass rounded-2xl p-6">
        <div className="flex flex-wrap items-start gap-4">
          <CompanyAvatar name={p.fullName} color={p.avatarColor} size="lg" />
          <div className="flex-1">
            <h1 className="text-xl font-bold">{p.fullName}</h1>
            <p className="text-sm text-primary">{p.headline}</p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" aria-hidden="true" />{p.location}</p>
            <button type="button" onClick={() => setActiveSection("connections")} className="mt-2 flex items-center gap-3 text-xs font-semibold text-primary hover:underline">
              <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden="true" />{p.followers.toLocaleString()} {t("networkUI.profile.followers")}</span>
              <span>{p.following.toLocaleString()} {t("networkUI.profile.following")}</span>
            </button>
          </div>
        </div>
        <p className="mt-4 text-sm text-muted-foreground leading-relaxed">{p.about}</p>
      </div>

      <div className="net-glass rounded-2xl border-primary/20 p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-sm font-bold"><Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />{t("networkUI.profile.aiOptimizer")}</p>
          {!optimizer.result && !optimizer.loading && <Button size="sm" onClick={optimizer.run}>{t("networkUI.profile.runOptimizer")}</Button>}
        </div>
        {optimizer.loading && <AIThinkingIndicator label={t("networkUI.profile.optimizing")} />}
        {optimizer.result && (
          <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            {optimizer.result.map((tip) => <li key={tip}>• {tip}</li>)}
          </ul>
        )}
      </div>

      <InfoCard icon={Briefcase} title={t("networkUI.profile.experience")}>
        <ul className="flex flex-col gap-3">
          {p.experience.map((e) => (
            <li key={e.id}>
              <p className="text-sm font-semibold">{e.title}</p>
              <p className="text-xs text-muted-foreground">{e.company} · {e.period}</p>
            </li>
          ))}
        </ul>
      </InfoCard>

      <InfoCard icon={Sparkles} title={t("networkUI.profile.skills")}>
        <div className="flex flex-wrap gap-1.5">
          {p.skills.map((s) => <span key={s} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{s}</span>)}
        </div>
      </InfoCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <InfoCard icon={GraduationCap} title={t("networkUI.profile.education")}>
          <ul className="flex flex-col gap-2">
            {p.education.map((e) => (
              <li key={e.id} className="text-sm">
                <p className="font-semibold">{e.degree}</p>
                <p className="text-xs text-muted-foreground">{e.institution} · {e.period}</p>
              </li>
            ))}
          </ul>
        </InfoCard>

        <InfoCard icon={Languages} title={t("networkUI.profile.languages")}>
          <div className="flex flex-wrap gap-1.5">
            {p.languages.map((l) => <span key={l} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">{l}</span>)}
          </div>
        </InfoCard>
      </div>

      <InfoCard icon={Folder} title={t("networkUI.profile.projects")}>
        <div className="grid gap-3 sm:grid-cols-2">
          {p.projects.map((proj) => (
            <div key={proj.id} className="rounded-xl border border-border/50 p-3">
              <p className="text-sm font-semibold">{proj.title}</p>
              <p className="text-xs text-muted-foreground">{proj.description}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{t("networkUI.profile.portfolio")}: <span className="text-primary">{p.portfolioUrl}</span></p>
      </InfoCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <InfoCard icon={Award} title={t("networkUI.profile.certificates")}>
          <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            {p.certificates.map((c) => <li key={c}>• {c}</li>)}
          </ul>
        </InfoCard>

        <InfoCard icon={Trophy} title={t("networkUI.profile.achievements")}>
          <ul className="flex flex-col gap-1.5">
            {p.achievements.map((a) => (
              <li key={a.id} className="text-sm">
                <span className="font-medium">{a.title}</span>
                <span className="text-xs text-muted-foreground"> — {a.date}</span>
              </li>
            ))}
          </ul>
        </InfoCard>
      </div>

      <InfoCard icon={MessageSquareQuote} title={t("networkUI.profile.recommendations")}>
        <ul className="flex flex-col gap-3">
          {MOCK_RECOMMENDATIONS.map((rec) => (
            <li key={rec.id} className="flex items-start gap-3">
              <CompanyAvatar name={rec.authorName} color={rec.authorColor} size="sm" />
              <div>
                <p className="text-sm font-semibold">{rec.authorName}</p>
                <p className="text-xs text-muted-foreground">{rec.authorHeadline}</p>
                <p className="mt-1 text-sm text-muted-foreground">"{rec.text}"</p>
              </div>
            </li>
          ))}
        </ul>
      </InfoCard>
    </div>
  );
}
