import { UserCheck } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Progress } from "@/components/ui/progress";
import { MOCK_PROFILE } from "../../mock/mockProfile";

function computeCompleteness(): number {
  const checks = [
    MOCK_PROFILE.bio.length > 0,
    MOCK_PROFILE.skills.length >= 3,
    MOCK_PROFILE.experience.length > 0,
    MOCK_PROFILE.education.length > 0,
    MOCK_PROFILE.languages.length > 0,
    MOCK_PROFILE.projects.length > 0,
    Boolean(MOCK_PROFILE.links.linkedin),
    Boolean(MOCK_PROFILE.links.github),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export function ProfileCompletionWidget() {
  const { t } = useLanguage();
  const pct = computeCompleteness();

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <UserCheck className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-xs font-medium text-muted-foreground">{t("careerDash.widget.profileCompletion")}</p>
          <p className="text-xl font-black">{pct}%</p>
        </div>
      </div>
      <Progress value={pct} aria-label={t("careerDash.widget.profileCompletion")} />
    </div>
  );
}
