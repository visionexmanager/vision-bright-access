import { Sprout, GraduationCap, Briefcase, Baby, MessageCircle, Landmark } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAiReadingPreferences } from "@/hooks/library/useAiReadingPreferences";
import type { AiReadingMode } from "@/lib/types/library-ai";

const MODES: AiReadingMode[] = ["beginner", "student", "professional", "child", "simple_language", "academic"];

const MODE_ICONS: Record<AiReadingMode, typeof Sprout> = {
  beginner: Sprout,
  student: GraduationCap,
  professional: Briefcase,
  child: Baby,
  simple_language: MessageCircle,
  academic: Landmark,
};

/**
 * Reading-level selector for the AI Reading Assistant — applies to every
 * tab in the sidebar (chat, summary, translate, explain-selection, etc.)
 * since useLibraryAiAssistant/useLibraryAiChat/useSmartSummary all read the
 * chosen mode from the same useAiReadingPreferences source. Rendered once
 * in the sidebar header rather than per-tab.
 */
export function ReadingModeSelector() {
  const { t } = useLanguage();
  const { readingMode, setReadingMode } = useAiReadingPreferences();
  const Icon = MODE_ICONS[readingMode];

  return (
    <Select value={readingMode} onValueChange={(v) => setReadingMode(v as AiReadingMode)}>
      <SelectTrigger aria-label={t("library.ai.readingMode.label")} className="mb-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent>
        {MODES.map((mode) => (
          <SelectItem key={mode} value={mode}>
            {t(`library.ai.readingMode.${mode}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
