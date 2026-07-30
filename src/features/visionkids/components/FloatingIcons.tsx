import { motion } from "framer-motion";
import { Star, Heart, Sparkles, Sun, Cloud, Rainbow } from "lucide-react";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { floatLoop } from "@/features/visionkids/utils/animations";

const ICONS = [
  { Icon: Star, className: "left-[8%] top-[15%] text-kids-accent", delay: 0 },
  { Icon: Heart, className: "left-[85%] top-[20%] text-kids-pink", delay: 0.4 },
  { Icon: Sparkles, className: "left-[15%] top-[70%] text-kids-purple", delay: 0.8 },
  { Icon: Sun, className: "left-[90%] top-[65%] text-kids-secondary", delay: 1.2 },
  { Icon: Cloud, className: "left-[50%] top-[10%] text-kids-primary", delay: 0.2 },
  { Icon: Rainbow, className: "left-[70%] top-[85%] text-kids-green", delay: 1.6 },
];

/** Purely decorative — hidden from screen readers and skipped entirely under reduced motion. */
export function FloatingIcons() {
  const reduced = useKidsReducedMotion();
  if (reduced) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {ICONS.map(({ Icon, className, delay }, i) => (
        <motion.div
          key={i}
          className={`absolute opacity-30 ${className}`}
          animate={floatLoop(false)}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay }}
        >
          <Icon className="h-8 w-8" />
        </motion.div>
      ))}
    </div>
  );
}
