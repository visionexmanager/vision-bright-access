import { useLanguage } from "@/contexts/LanguageContext";
import type { AIModuleDef } from "./types";

interface AIModuleCardProps {
  module: AIModuleDef;
  onOpen: (id: AIModuleDef["id"]) => void;
}

export function AIModuleCard({ module, onOpen }: AIModuleCardProps) {
  const { t } = useLanguage();
  const Icon = module.icon;

  return (
    <button
      type="button"
      onClick={() => onOpen(module.id)}
      className="ai-glass group relative flex h-full flex-col items-start gap-3 rounded-2xl p-5 text-start transition-all duration-300 hover:-translate-y-1 hover:ai-neon-ring focus-visible:-translate-y-1 focus-visible:ai-neon-ring focus-visible:outline-none"
    >
      <span
        className="flex h-11 w-11 items-center justify-center rounded-xl text-white transition-transform duration-300 group-hover:scale-110"
        style={{ background: module.accent }}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="text-base font-bold">{t(module.titleKey)}</span>
      <span className="text-sm text-muted-foreground">{t(module.descKey)}</span>
    </button>
  );
}
