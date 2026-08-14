import { motion, useReducedMotion } from "framer-motion";

interface DesignStudioMotionProps {
  kind: "home" | "fashion";
  progress: number;
}

export function DesignStudioMotion({ kind, progress }: DesignStudioMotionProps) {
  const reduceMotion = useReducedMotion();
  const normalized = Math.min(1, Math.max(0, progress));
  const accents = kind === "home"
    ? ["bg-cyan-400/70", "bg-violet-400/70", "bg-amber-300/70"]
    : ["bg-violet-400/70", "bg-cyan-400/70", "bg-fuchsia-300/70"];

  return (
    <div aria-hidden="true" className="relative h-20 overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 shadow-inner">
      <motion.div
        className="absolute inset-y-0 start-0 bg-gradient-to-r from-cyan-400/10 via-violet-400/20 to-amber-300/10"
        animate={{ width: `${Math.max(12, normalized * 100)}%` }}
        transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 90, damping: 20 }}
      />
      <div className="absolute inset-0 flex items-end justify-around px-6 pb-3">
        {accents.map((accent, index) => (
          <motion.span
            key={accent}
            className={`block rounded-sm shadow-[0_0_18px_currentColor] ${accent}`}
            style={{ width: kind === "home" ? 34 + index * 10 : 18 + index * 9, height: kind === "home" ? 22 + index * 9 : 42 + index * 8 }}
            animate={reduceMotion ? undefined : { y: [0, -4 - index, 0], rotate: kind === "fashion" ? [0, index - 1, 0] : 0 }}
            transition={{ duration: 2.8 + index * 0.35, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </div>
      <motion.div
        className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-gradient-to-r from-cyan-300 via-violet-300 to-amber-200"
        animate={{ scaleX: normalized }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.45, ease: "easeOut" }}
      />
    </div>
  );
}
