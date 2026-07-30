import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { cardHover, cardTap } from "@/features/visionkids/utils/animations";
import type { StudioTool } from "@/features/visionkids/data/studioTools";

const COLOR_STYLES: Record<StudioTool["color"], string> = {
  primary: "hover:border-kids-primary/60 bg-kids-primary/10",
  secondary: "hover:border-kids-secondary/60 bg-kids-secondary/10",
  accent: "hover:border-kids-accent/60 bg-kids-accent/10",
  pink: "hover:border-kids-pink/60 bg-kids-pink/10",
  green: "hover:border-kids-green/60 bg-kids-green/10",
  purple: "hover:border-kids-purple/60 bg-kids-purple/10",
};

export function ToolCard({ tool }: { tool: StudioTool }) {
  const { t } = useLanguage();
  const reduced = useKidsReducedMotion();
  const [border, bg] = COLOR_STYLES[tool.color].split(" ");

  return (
    <motion.div whileHover={cardHover(reduced)} whileTap={cardTap(reduced)}>
      <Link to={tool.slug} className={`flex flex-col items-center gap-2 rounded-2xl border-2 border-border bg-card p-4 text-center transition-colors ${border}`}>
        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl text-3xl ${bg}`} aria-hidden="true">{tool.emoji}</div>
        <span className="text-sm font-bold">{t(tool.titleKey)}</span>
        <span className="text-xs text-muted-foreground">{t(tool.descKey)}</span>
      </Link>
    </motion.div>
  );
}
