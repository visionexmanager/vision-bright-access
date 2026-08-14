import { motion, useReducedMotion } from "framer-motion";

interface CardTableMotionProps {
  kind: "cards" | "dominoes";
  progress: number;
}

export function CardTableMotion({ kind, progress }: CardTableMotionProps) {
  const reduceMotion = useReducedMotion();
  const normalized = Math.min(1, Math.max(0, progress));
  const items = kind === "cards" ? 5 : 7;

  return (
    <div aria-hidden="true" className="relative h-20 overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 shadow-inner">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.14),transparent_65%)]" />
      <div className="absolute inset-0 flex items-center justify-center">
        {Array.from({ length: items }, (_, index) => (
          <motion.span
            key={index}
            className={kind === "cards"
              ? "absolute h-11 w-8 rounded border border-white/40 bg-gradient-to-br from-violet-500/80 to-cyan-500/70 shadow-lg"
              : "mx-0.5 block h-8 w-12 rounded border border-white/40 bg-stone-100/90 shadow-lg"}
            style={kind === "cards" ? { transformOrigin: "50% 120%" } : undefined}
            animate={reduceMotion ? undefined : kind === "cards"
              ? { rotate: -24 + index * 12, x: (index - 2) * 18, y: [4, -3, 4] }
              : { y: [0, index % 2 ? -3 : 0, 0], rotate: [0, index % 2 ? 2 : -2, 0] }}
            transition={{ duration: 2.5 + index * 0.12, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </div>
      <motion.div className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-gradient-to-r from-cyan-300 via-violet-300 to-amber-200"
        animate={{ scaleX: normalized }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.45, ease: "easeOut" }} />
    </div>
  );
}
