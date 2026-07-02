import { Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface AIThinkingIndicatorProps {
  label?: string;
}

export function AIThinkingIndicator({ label }: AIThinkingIndicatorProps) {
  const { t } = useLanguage();
  const text = label ?? t("aiSuite.thinking");

  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/30 px-4 py-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full ai-neon-ring bg-primary/10 text-primary">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <span className="text-sm text-muted-foreground">{text}</span>
      <span className="flex gap-1" aria-hidden="true">
        <span className="ai-thinking-dot h-1.5 w-1.5 rounded-full bg-primary" style={{ animationDelay: "0ms" }} />
        <span className="ai-thinking-dot h-1.5 w-1.5 rounded-full bg-primary" style={{ animationDelay: "150ms" }} />
        <span className="ai-thinking-dot h-1.5 w-1.5 rounded-full bg-primary" style={{ animationDelay: "300ms" }} />
      </span>
    </div>
  );
}
