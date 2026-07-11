import { useState } from "react";
import { Wrench, Plus, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MOCK_PROFILE } from "../../mock/mockProfile";
import type { SkillEntry, SkillProficiency } from "../../types";

const PROFICIENCY_LEVELS: SkillProficiency[] = ["beginner", "intermediate", "advanced", "expert"];

const PROFICIENCY_COLOR: Record<SkillProficiency, string> = {
  beginner: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  intermediate: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  advanced: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  expert: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

export function ProfileSkills() {
  const { t } = useLanguage();
  const [skills, setSkills] = useState<SkillEntry[]>(MOCK_PROFILE.skills);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [proficiency, setProficiency] = useState<SkillProficiency>("intermediate");
  const [years, setYears] = useState("1");

  const addSkill = () => {
    if (!name.trim()) return;
    const entry: SkillEntry = {
      id: `sk-${Date.now()}`,
      name: name.trim(),
      category: category.trim() || t("careerDash.profile.skills.uncategorized"),
      proficiency,
      yearsExperience: Number(years) || 0,
      lastUsed: new Date().toISOString().slice(0, 10),
    };
    setSkills((prev) => [...prev, entry]);
    setName("");
    setCategory("");
    setYears("1");
  };

  const removeSkill = (id: string) => setSkills((prev) => prev.filter((s) => s.id !== id));

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6">
      <div className="mb-4 flex items-center gap-2">
        <Wrench className="h-4 w-4 text-primary" aria-hidden="true" />
        <h2 className="font-bold">{t("careerDash.profile.skills.title")}</h2>
      </div>

      <ul className="mb-5 flex flex-col gap-2">
        {skills.map((skill) => (
          <li key={skill.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/50 p-3">
            <div>
              <p className="text-sm font-semibold">{skill.name}</p>
              <p className="text-xs text-muted-foreground">
                {skill.category} · {t("careerDash.profile.skills.years").replace("{count}", String(skill.yearsExperience))} · {t("careerDash.profile.skills.lastUsed")}: {skill.lastUsed}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${PROFICIENCY_COLOR[skill.proficiency]}`}>
                {t(`careerDash.profile.skills.level.${skill.proficiency}`)}
              </span>
              <button
                type="button"
                onClick={() => removeSkill(skill.id)}
                aria-label={t("careerDash.profile.skills.remove").replace("{name}", skill.name)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="grid gap-2 rounded-xl border border-dashed border-border p-4 sm:grid-cols-5">
        <div className="sm:col-span-2">
          <Label htmlFor="skill-name" className="mb-1 block text-xs text-muted-foreground">{t("careerDash.profile.skills.name")}</Label>
          <Input id="skill-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="skill-category" className="mb-1 block text-xs text-muted-foreground">{t("careerDash.profile.skills.category")}</Label>
          <Input id="skill-category" value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>
        <div>
          <Label className="mb-1 block text-xs text-muted-foreground">{t("careerDash.profile.skills.proficiency")}</Label>
          <Select value={proficiency} onValueChange={(v) => setProficiency(v as SkillProficiency)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PROFICIENCY_LEVELS.map((level) => (
                <SelectItem key={level} value={level}>{t(`careerDash.profile.skills.level.${level}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label htmlFor="skill-years" className="mb-1 block text-xs text-muted-foreground">{t("careerDash.profile.skills.yearsLabel")}</Label>
            <Input id="skill-years" type="number" min={0} max={50} value={years} onChange={(e) => setYears(e.target.value)} />
          </div>
          <Button size="icon" onClick={addSkill} aria-label={t("careerDash.profile.skills.add")} className="shrink-0">
            <Plus className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
