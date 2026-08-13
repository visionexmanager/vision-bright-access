import { motion, useReducedMotion } from "framer-motion";

type Props =
  | { kind:"balance"; value:number }
  | { kind:"pendulum"; value:number }
  | { kind:"trajectory"; value:number; attempt:number }
  | { kind:"magnet"; value:number; attracting:boolean; attempt:number };

const scene = "relative h-48 overflow-hidden rounded-3xl border border-cyan-200/20 bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950 shadow-xl";

/** Decorative simulation only; scoring remains in the deterministic physics engine. */
export function PhysicsLabMotion(props: Props) {
  const reduced = useReducedMotion();
  if (props.kind === "balance") {
    const angle = Math.max(-12, Math.min(12, props.value * 1.5));
    return <div aria-hidden="true" className={scene}><span className="absolute bottom-5 left-1/2 h-24 w-3 -translate-x-1/2 bg-slate-300 [clip-path:polygon(50%_0,100%_100%,0_100%)]"/><motion.div className="absolute left-[12%] top-1/2 h-2 w-3/4 origin-center rounded bg-amber-300" animate={{rotate:reduced?0:angle}} transition={{type:"spring",stiffness:90,damping:14}}><span className="absolute -bottom-14 left-4 h-14 w-16 rounded-b-xl border-x-2 border-b-4 border-slate-300"/><span className="absolute -bottom-14 right-4 h-14 w-16 rounded-b-xl border-x-2 border-b-4 border-slate-300"/></motion.div></div>;
  }
  if (props.kind === "pendulum") {
    const swing = Math.max(8, 30-props.value*4);
    return <div aria-hidden="true" className={scene}><div className="absolute left-1/2 top-4 h-4 w-32 -translate-x-1/2 rounded bg-slate-300"/><motion.div className="absolute left-1/2 top-6 h-32 w-1 origin-top bg-cyan-200" animate={reduced?{rotate:0}:{rotate:[-swing,swing,-swing]}} transition={{duration:Math.max(1.1,props.value*.7),repeat:Infinity,ease:"easeInOut"}}><span className="absolute -bottom-6 -left-5 h-11 w-11 rounded-full bg-gradient-to-br from-slate-100 to-slate-500 shadow-xl"/></motion.div></div>;
  }
  if (props.kind === "trajectory") {
    const landing = Math.min(88, 12+props.value);
    return <div aria-hidden="true" className={scene}><span className="absolute bottom-5 left-5 h-10 w-20 -rotate-12 rounded bg-slate-500"/><span className="absolute bottom-5 right-[8%] h-3 w-20 rounded bg-amber-300"/><motion.span key={props.attempt} className="absolute bottom-12 left-[10%] h-6 w-6 rounded-full bg-orange-400 shadow-[0_0_16px_#fb923c]" initial={reduced?false:{left:"10%",bottom:"18%"}} animate={reduced?{left:`${landing}%`,bottom:"18%"}:{left:["10%",`${landing/2}%`,`${landing}%`],bottom:["18%","78%","18%"]}} transition={{duration:.9,ease:"easeInOut"}}/></div>;
  }
  const gap = Math.max(4, Math.min(22, props.value*3));
  return <div aria-hidden="true" className={scene}><motion.span className="absolute left-[18%] top-1/2 h-20 w-28 -translate-y-1/2 rounded-l-full border-[18px] border-r-0 border-red-500" animate={{left:reduced?"18%":`${18+(props.attracting?gap/3:-gap/5)}%`}}/><motion.span className="absolute right-[18%] top-1/2 h-20 w-28 -translate-y-1/2 rounded-r-full border-[18px] border-l-0 border-blue-500" animate={{right:reduced?"18%":`${18+(props.attracting?gap/3:-gap/5)}%`}}/><motion.span key={props.attempt} className="absolute left-1/2 top-1/2 h-2 w-28 -translate-x-1/2 rounded bg-cyan-100/70" animate={reduced?{opacity:.6}:{opacity:[.2,1,.2],scaleX:props.attracting?[.7,1,.7]:[1,.55,1]}} transition={{duration:.7}}/></div>;
}
