import { motion, useReducedMotion } from "framer-motion";
import { readGameSettings } from "@/features/arcade/core/gameSettings";

export function LexiconPulse({ progress, danger = false }: { progress: number; danger?: boolean }) {
  const reducedMotion = Boolean(useReducedMotion()) || readGameSettings().reducedMotion;
  const safeProgress = Math.max(0, Math.min(100, progress));
  return (
    <div className="relative h-3 overflow-hidden rounded-full bg-muted" aria-hidden="true">
      <motion.div className={`absolute inset-y-0 start-0 rounded-full ${danger ? "bg-amber-500" : "bg-gradient-to-r from-cyan-500 via-violet-500 to-primary"}`} initial={false} animate={{ width: `${safeProgress}%` }} transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 130, damping: 22 }} />
      {!reducedMotion && safeProgress > 0 && <motion.span className="absolute inset-y-0 w-12 bg-gradient-to-r from-transparent via-white/45 to-transparent" animate={{ x: ["-100%", "900%"] }} transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }} />}
    </div>
  );
}
