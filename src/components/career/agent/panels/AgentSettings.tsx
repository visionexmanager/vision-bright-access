import { useState, type ReactNode } from "react";
import { X, Plus, Bot, Brain, Eye, Type, Zap } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAgent } from "@/contexts/AgentContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { AgentPersonality } from "../types";

const PERSONALITIES: AgentPersonality[] = ["professional", "friendly", "minimal", "motivational", "executive"];
const AVATAR_EMOJIS = ["✨", "🤖", "🚀", "🧭", "💡", "🌟"];
const AVATAR_COLORS = ["#6366f1", "#ec4899", "#10b981", "#f59e0b", "#0ea5e9", "#a855f7"];

function TagEditor({ label, values, onChange }: { label: string; values: string[]; onChange: (values: string[]) => void }) {
  const [draft, setDraft] = useState("");

  const addTag = () => {
    if (!draft.trim() || values.includes(draft.trim())) return;
    onChange([...values, draft.trim()]);
    setDraft("");
  };

  return (
    <div>
      <Label className="mb-1.5 block text-xs text-muted-foreground">{label}</Label>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span key={v} className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            {v}
            <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} aria-label={`Remove ${v}`} className="rounded-full hover:bg-primary/20">
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} />
        <button type="button" onClick={addTag} aria-label="Add" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border hover:bg-muted">
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function SettingsRow({ icon: Icon, title, desc, control }: { icon: typeof Bot; title: string; desc: string; control: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      {control}
    </div>
  );
}

export function AgentSettings() {
  const { t } = useLanguage();
  const { identity, updateIdentity, memory, updateMemory, accessibility, updateAccessibility } = useAgent();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="type-heading mb-1">{t("agentUI.nav.settings")}</h1>
        <p className="text-sm text-muted-foreground">{t("agentUI.settings.subtitle")}</p>
      </div>

      <section className="agent-glass rounded-2xl p-6" aria-labelledby="agent-settings-identity">
        <h2 id="agent-settings-identity" className="mb-4 flex items-center gap-2 font-bold"><Bot className="h-4 w-4 text-primary" aria-hidden="true" />{t("agentUI.settings.identity")}</h2>
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="agent-name" className="mb-1.5 block text-xs text-muted-foreground">{t("agentUI.settings.agentName")}</Label>
            <Input id="agent-name" value={identity.name} onChange={(e) => updateIdentity({ name: e.target.value })} />
          </div>
        </div>
        <div className="mb-4">
          <Label className="mb-1.5 block text-xs text-muted-foreground">{t("agentUI.settings.avatar")}</Label>
          <div className="flex flex-wrap gap-2">
            {AVATAR_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => updateIdentity({ avatarEmoji: emoji })}
                aria-pressed={identity.avatarEmoji === emoji}
                className={`flex h-10 w-10 items-center justify-center rounded-full border text-lg transition-all ${identity.avatarEmoji === emoji ? "border-primary ring-2 ring-primary/40" : "border-border"}`}
              >
                {emoji}
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {AVATAR_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => updateIdentity({ avatarColor: color })}
                aria-label={color}
                aria-pressed={identity.avatarColor === color}
                className={`h-6 w-6 rounded-full ring-offset-2 ring-offset-background transition-all ${identity.avatarColor === color ? "ring-2 ring-primary" : ""}`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs text-muted-foreground">{t("agentUI.settings.personality")}</Label>
          <div className="grid gap-2 sm:grid-cols-5">
            {PERSONALITIES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => updateIdentity({ personality: p })}
                aria-pressed={identity.personality === p}
                className={`rounded-xl border px-3 py-2.5 text-center text-xs font-semibold transition-all ${identity.personality === p ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
              >
                {t(`agentUI.personality.${p}`)}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="agent-glass rounded-2xl p-6" aria-labelledby="agent-settings-memory">
        <h2 id="agent-settings-memory" className="mb-1 flex items-center gap-2 font-bold"><Brain className="h-4 w-4 text-primary" aria-hidden="true" />{t("agentUI.settings.memory")}</h2>
        <p className="mb-4 text-xs text-muted-foreground">{t("agentUI.settings.memoryDesc")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <TagEditor label={t("agentUI.settings.knownSkills")} values={memory.knownSkills} onChange={(v) => updateMemory({ knownSkills: v })} />
          <TagEditor label={t("agentUI.settings.careerInterests")} values={memory.careerInterests} onChange={(v) => updateMemory({ careerInterests: v })} />
          <TagEditor label={t("agentUI.settings.preferredCountries")} values={memory.preferredCountries} onChange={(v) => updateMemory({ preferredCountries: v })} />
          <TagEditor label={t("agentUI.settings.preferredIndustries")} values={memory.preferredIndustries} onChange={(v) => updateMemory({ preferredIndustries: v })} />
          <TagEditor label={t("agentUI.settings.preferredJobTypes")} values={memory.preferredJobTypes} onChange={(v) => updateMemory({ preferredJobTypes: v })} />
          <div>
            <Label htmlFor="agent-min-salary" className="mb-1.5 block text-xs text-muted-foreground">{t("agentUI.settings.preferredSalaryMin")}</Label>
            <Input id="agent-min-salary" type="number" min={0} value={memory.preferredSalaryMin} onChange={(e) => updateMemory({ preferredSalaryMin: Number(e.target.value) || 0 })} />
          </div>
        </div>
      </section>

      <section className="agent-glass rounded-2xl p-6" aria-labelledby="agent-settings-a11y">
        <h2 id="agent-settings-a11y" className="mb-1 font-bold">{t("careerDash.settings.accessibility")}</h2>
        <p className="mb-3 text-xs text-muted-foreground">{t("agentUI.settings.accessibilityDesc")}</p>
        <div className="divide-y divide-border/60">
          <SettingsRow icon={Eye} title={t("careerDash.settings.highContrast")} desc={t("careerDash.settings.highContrastDesc")} control={<Switch checked={accessibility.highContrast} onCheckedChange={(v) => updateAccessibility({ highContrast: v })} aria-label={t("careerDash.settings.highContrast")} />} />
          <SettingsRow icon={Type} title={t("careerDash.settings.largeText")} desc={t("careerDash.settings.largeTextDesc")} control={<Switch checked={accessibility.largeText} onCheckedChange={(v) => updateAccessibility({ largeText: v })} aria-label={t("careerDash.settings.largeText")} />} />
          <SettingsRow icon={Zap} title={t("careerDash.settings.reducedMotion")} desc={t("careerDash.settings.reducedMotionDesc")} control={<Switch checked={accessibility.reducedMotion} onCheckedChange={(v) => updateAccessibility({ reducedMotion: v })} aria-label={t("careerDash.settings.reducedMotion")} />} />
        </div>
      </section>
    </div>
  );
}
