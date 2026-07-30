import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { useRipple } from "@/features/visionkids/hooks/useRipple";
import { cardHover, cardTap, slideUp } from "@/features/visionkids/utils/animations";
import type { KidsSection } from "@/features/visionkids/types/visionkids.types";

// Full class strings (not interpolated) so Tailwind's JIT scanner can see them.
const COLOR_STYLES: Record<KidsSection["color"], { border: string; iconBg: string; iconText: string; glow: string }> = {
  primary: { border: "hover:border-kids-primary/60", iconBg: "bg-kids-primary/10", iconText: "text-kids-primary", glow: "var(--kids-primary)" },
  secondary: { border: "hover:border-kids-secondary/60", iconBg: "bg-kids-secondary/10", iconText: "text-kids-secondary", glow: "var(--kids-secondary)" },
  accent: { border: "hover:border-kids-accent/60", iconBg: "bg-kids-accent/10", iconText: "text-kids-accent", glow: "var(--kids-accent)" },
  pink: { border: "hover:border-kids-pink/60", iconBg: "bg-kids-pink/10", iconText: "text-kids-pink", glow: "var(--kids-pink)" },
  green: { border: "hover:border-kids-green/60", iconBg: "bg-kids-green/10", iconText: "text-kids-green", glow: "var(--kids-green)" },
  purple: { border: "hover:border-kids-purple/60", iconBg: "bg-kids-purple/10", iconText: "text-kids-purple", glow: "var(--kids-purple)" },
};

const MotionLink = motion.create(Link);

interface SectionCardProps {
  section: KidsSection;
  index: number;
}

export function SectionCard({ section, index }: SectionCardProps) {
  const { t } = useLanguage();
  const reduced = useKidsReducedMotion();
  const { ripples, onPointerDown, onKeyDown } = useRipple();
  const styles = COLOR_STYLES[section.color];
  const Icon = section.icon;
  const title = t(section.titleKey);
  const description = t(section.descKey);

  return (
    <MotionLink
      to={`/kids/${section.slug}`}
      variants={slideUp(reduced)}
      whileHover={cardHover(reduced)}
      whileTap={cardTap(reduced)}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      className={`kids-card-glow group relative flex flex-col gap-3 overflow-hidden rounded-2xl border-2 border-border bg-card p-5 text-start transition-colors ${styles.border}`}
      style={{ ["--kids-glow" as string]: styles.glow }}
      aria-label={`${title} — ${description}`}
    >
      {ripples.map((r) => (
        <span
          key={r.id}
          className={`kids-ripple ${styles.iconText}`}
          style={{ left: r.x, top: r.y, width: r.size, height: r.size }}
          aria-hidden="true"
        />
      ))}

      <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${styles.iconBg}`} aria-hidden="true">
        <Icon className={`h-6 w-6 ${styles.iconText}`} strokeWidth={2.25} />
      </div>

      <div>
        <h3 className="font-heading text-lg font-bold text-foreground">
          <span aria-hidden="true" className="me-1.5">{section.emoji}</span>
          {title}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </MotionLink>
  );
}
