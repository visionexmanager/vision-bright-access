import { useState } from "react";
import { Languages, Plus, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCareerProfile } from "@/hooks/career/useCareerProfile";
import { CareerErrorState } from "../../../ui/CareerErrorState";
import { ProfileSectionCard } from "./ProfileSectionCard";

// Simplified from the earlier mock's LanguageEntry shape (per-language
// proficiency) to a flat tag list — career_profiles.languages is a plain
// text[] column, no per-language metadata exists in the deployed schema.
export function ProfileLanguages() {
  const { t } = useLanguage();
  const { profile, isLoading, error, refetch, saveProfile, isSaving } = useCareerProfile();
  const [name, setName] = useState("");

  if (isLoading) {
    return <div className="rounded-2xl border border-border/60 bg-card p-6 animate-pulse h-24" aria-hidden="true" />;
  }
  if (error) {
    return <CareerErrorState message={error} onRetry={refetch} className="rounded-2xl border border-border/60 bg-card" />;
  }

  const languages = profile?.languages ?? [];

  const addLanguage = () => {
    const trimmed = name.trim();
    if (!trimmed || languages.includes(trimmed)) return;
    saveProfile({ languages: [...languages, trimmed] });
    setName("");
  };

  const removeLanguage = (lang: string) => saveProfile({ languages: languages.filter((l) => l !== lang) });

  return (
    <ProfileSectionCard icon={Languages} title={t("careerDash.profile.languages.title")}>
      <div className="flex flex-wrap gap-2">
        {languages.length > 0 ? (
          languages.map((lang) => (
            <span key={lang} className="flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium">
              {lang}
              <button
                type="button"
                onClick={() => removeLanguage(lang)}
                disabled={isSaving}
                aria-label={t("careerDash.profile.skills.remove").replace("{name}", lang)}
                className="rounded-md p-0.5 text-muted-foreground hover:bg-muted hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">{t("careerDash.profile.languages.empty")}</p>
        )}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addLanguage()}
          placeholder={t("careerDash.profile.skills.name")}
          className="h-8 text-xs"
        />
        <Button size="icon" className="h-8 w-8 shrink-0" onClick={addLanguage} disabled={isSaving} aria-label={t("careerDash.profile.skills.add")}>
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
    </ProfileSectionCard>
  );
}
