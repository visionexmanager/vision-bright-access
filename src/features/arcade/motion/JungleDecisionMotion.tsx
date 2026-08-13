import { motion, useReducedMotion } from "framer-motion";
import { readGameSettings } from "@/features/arcade/core/gameSettings";

type JungleDecisionMotionProps = { step: number; total: number; hp: number };

/** Decorative jungle progress scene. Essential state remains in the adjacent live text. */
export function JungleDecisionMotion({ step, total, hp }: JungleDecisionMotionProps) {
  const reduced = Boolean(useReducedMotion()) || readGameSettings().reducedMotion;
  const progress = Math.min(88, 10 + (step / Math.max(total - 1, 1)) * 78);
  const danger = hp < 30;

  return (
    <div aria-hidden="true" className="relative h-40 overflow-hidden rounded-2xl bg-gradient-to-b from-emerald-950 via-emerald-800 to-stone-950 shadow-inner">
      <span className="absolute inset-x-0 top-0 h-20 bg-[radial-gradient(circle_at_50%_0%,rgba(253,230,138,.55),transparent_62%)]" />
      <span className="absolute bottom-0 left-[42%] h-36 w-24 origin-bottom bg-amber-100/20 [clip-path:polygon(45%_0,55%_0,100%_100%,0_100%)]" />
      <motion.span
        className="absolute bottom-7 h-9 w-5 rounded-t-full bg-slate-950 shadow-[0_8px_12px_rgba(0,0,0,.5)] before:absolute before:-top-3 before:left-1/2 before:h-4 before:w-4 before:-translate-x-1/2 before:rounded-full before:bg-amber-900"
        animate={{ left: `${progress}%`, scale: danger ? 0.88 : 1 }}
        transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 85, damping: 18 }}
      />
      {!reduced && <><motion.span className="absolute left-[8%] top-5 text-3xl text-emerald-300/60" animate={{ y: [0, 8, 0], rotate: [-5, 5, -5] }} transition={{ duration: 3.6, repeat: Infinity }}>❧</motion.span><motion.span className="absolute right-[10%] top-9 text-2xl text-lime-200/55" animate={{ y: [0, -7, 0], rotate: [4, -4, 4] }} transition={{ duration: 4.2, repeat: Infinity }}>❧</motion.span></>}
      <span className={`absolute inset-x-0 bottom-0 h-2 ${danger ? "bg-red-500/70" : "bg-emerald-300/45"}`} />
    </div>
  );
}
