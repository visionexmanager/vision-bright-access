import { motion, useReducedMotion } from "framer-motion";
import { readGameSettings } from "@/features/arcade/core/gameSettings";

export function KnowledgeArenaMotion({ progress, urgent }: { progress:number; urgent:boolean }) {
  const reduced=Boolean(useReducedMotion())||readGameSettings().reducedMotion;
  return <div aria-hidden="true" className="relative h-28 overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 via-blue-950 to-slate-950">
    <span className="absolute inset-x-[8%] bottom-3 h-2 rounded bg-white/15"/><motion.span className={`absolute bottom-3 left-[8%] h-2 rounded ${urgent?"bg-amber-400":"bg-cyan-400"}`} animate={{width:`${Math.max(3,progress*.84)}%`}} transition={reduced?{duration:0}:{duration:.35,ease:"easeOut"}}/>
    {[18,38,58,78].map((left,i)=><motion.span key={left} className="absolute top-8 h-7 w-7 rotate-45 border-2 border-cyan-200/70 bg-blue-400/20" style={{left:`${left}%`}} animate={reduced?{}:{y:[0,-5,0],rotate:[45,55,45]}} transition={{duration:2.4+i*.25,repeat:Infinity}}/>)}
  </div>;
}
