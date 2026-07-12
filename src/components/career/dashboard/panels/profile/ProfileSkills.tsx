import { useState } from "react";
import { Wrench, Plus, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCareerProfile } from "@/hooks/career/useCareerProfile";
import { CareerErrorState } from "../../../ui/CareerErrorState";

// Simplified from the earlier mock's rich SkillEntry shape (proficiency,
// years, last-used) to a flat tag list — career_profiles.skills is a plain
// text[] column, no per-skill metadata exists in the deployed schema.
export function ProfileSkills() {
  const { t } = useLanguage();
  const { profile, isLoading, error, refetch, saveProfile, isSaving } = useCareerProfile();
  const [name, setName] = useState("");

  if (isLoading) {
    return <div className="rounded-2xl border border-border/60 bg-card p-6 animate-pulse h-32" aria-hidden="true" />;
  }
  if (error) {
    return <CareerErrorState message={error} onRetry={refetch} className="rounded-2xl border border-border/60 bg-card" />;
  }

  const skills = profile?.skills ?? [];

  const addSkill = () => {
    const trimmed = name.trim();
    if (!trimmed || skills.includes(trimmed)) return;
    saveProfile({ skills: [...skills, trimmed] });
    setName("");
  };

  const removeSkill = (skill: string) => saveProfile({ skills: skills.filter((s) => s !== skill) });

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6">
      <div className="mb-4 flex items-center gap-2">
        <Wrench className="h-4 w-4 text-primary" aria-hidden="true" />
        <h2 className="font-bold">{t("careerDash.profile.skills.title")}</h2>
      </div>

      {skills.length > 0 ? (
        <ul className="mb-5 flex flex-wrap gap-2">
          {skills.map((skill) => (
            <li key={skill} className="flex items-center gap-1.5 rounded-full border border-border/50 px-3 py-1.5 text-sm">
              {skill}
              <button
                type="button"
                onClick={() => removeSkill(skill)}
                disabled={isSaving}
                aria-label={t("careerDash.profile.skills.remove").replace("{name}", skill)}
                className="rounded-md p-0.5 text-muted-foreground hover:bg-muted hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-5 text-sm text-muted-foreground">{t("careerDash.profile.skills.empty")}</p>
      )}

      <div className="flex items-end gap-2 rounded-xl border border-dashed border-border p-4">
        <div className="flex-1">
          <Label htmlFor="skill-name" className="mb-1 block text-xs text-muted-foreground">{t("careerDash.profile.skills.name")}</Label>
          <Input id="skill-name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSkill()} />
        </div>
        <Button size="icon" onClick={addSkill} disabled={isSaving} aria-label={t("careerDash.profile.skills.add")} className="shrink-0">
          <Plus className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
