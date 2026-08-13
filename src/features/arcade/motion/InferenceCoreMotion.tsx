import { motion, useReducedMotion } from "framer-motion";
import { readGameSettings } from "@/features/arcade/core/gameSettings";

export function InferenceCoreMotion({ progress, alert = false }: { progress: number; alert?: boolean }) {
  const reducedMotion = Boolean(useReducedMotion()) || readGameSettings().reducedMotion;
  const safeProgress = Math.max(0, Math.min(100, progress));
  return (
    <div className="relative h-3 overflow-hidden rounded-full bg-muted" aria-hidden="true">
      <motion.div className={`absolute inset-y-0 start-0 rounded-full ${alert ? "bg-amber-500" : "bg-gradient-to-r from-violet-500 via-cyan-400 to-primary"}`} initial={false} animate={{ width: `${safeProgress}%` }} transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 20 }} />
      {!reducedMotion && safeProgress > 0 && <motion.span className="absolute inset-y-0 w-10 bg-gradient-to-r from-transparent via-white/50 to-transparent" animate={{ x: ["-100%", "1000%"] }} transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }} />}
    </div>
  );
}
