import { Lightbulb } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { MOCK_PROFILE } from "../../mock/mockProfile";

const SUGGESTED_SKILLS = ["Next.js", "GraphQL", "AI Prompt Engineering", "Design Systems", "Testing (Playwright)", "Kubernetes"];

export function RecommendedSkillsWidget() {
  const { t } = useLanguage();
  const known = new Set(MOCK_PROFILE.skills.map((s) => s.name.toLowerCase()));
  const suggestions = SUGGESTED_SKILLS.filter((s) => !known.has(s.toLowerCase())).slice(0, 5);

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-primary" aria-hidden="true" />
        <h3 className="text-sm font-bold">{t("careerDash.widget.recommendedSkills")}</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((skill) => (
          <span key={skill} className="rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium">
            {skill}
          </span>
        ))}
      </div>
    </div>
  );
}
