// Still mock — see ProfileExperience.tsx (no normalized projects sub-table). Future phase.
import { Folder } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { MOCK_PROFILE } from "../../mock/mockProfile";
import { ProfileSectionCard } from "./ProfileSectionCard";

export function ProfileProjects() {
  const { t } = useLanguage();

  return (
    <ProfileSectionCard icon={Folder} title={t("careerDash.profile.projects.title")}>
      <div className="grid gap-3 sm:grid-cols-2">
        {MOCK_PROFILE.projects.map((project) => (
          <div key={project.id} className="rounded-xl border border-border/50 p-4">
            <p className="text-sm font-bold">{project.title}</p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{project.description}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {project.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{tag}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ProfileSectionCard>
  );
}
