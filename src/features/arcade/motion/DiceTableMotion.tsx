import { motion, useReducedMotion } from "framer-motion";

export function DiceTableMotion({ progress }: { progress: number }) {
  const reduceMotion = useReducedMotion();
  const normalized = Math.min(1, Math.max(0, progress));
  return (
    <div aria-hidden="true" className="relative h-20 overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900">
      <div className="absolute inset-0 flex items-center justify-center gap-3">
        {[1, 3, 5, 2, 6].map((value, index) => (
          <motion.span key={value} className="grid h-10 w-10 place-items-center rounded-lg border border-white/50 bg-stone-100 text-lg font-black text-slate-900 shadow-lg"
            animate={reduceMotion ? undefined : { y: [0, -5 - (index % 2) * 3, 0], rotate: [0, index % 2 ? 7 : -7, 0] }}
            transition={{ duration: 2.2 + index * 0.17, repeat: Infinity, ease: "easeInOut" }}>
            {value}
          </motion.span>
        ))}
      </div>
      <motion.div className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-gradient-to-r from-cyan-300 via-violet-300 to-amber-200"
        animate={{ scaleX: normalized }} transition={reduceMotion ? { duration: 0 } : { duration: 0.45 }} />
    </div>
  );
}
