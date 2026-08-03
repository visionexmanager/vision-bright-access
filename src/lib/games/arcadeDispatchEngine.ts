export type DispatchKind="arrival"|"departure"|"emergency"|"cargo";
export type DispatchJob={id:string;label:string;kind:DispatchKind;priority:number;deadline:number;resource:string};
export type DispatchState={minute:number;score:number;safety:number;completed:number;jobs:DispatchJob[]};
export function createDispatchState(jobs:DispatchJob[]):DispatchState{return{minute:0,score:0,safety:100,completed:0,jobs:jobs.map(job=>({...job}))}}
export function dispatchJob(state:DispatchState,id:string,resource:string):DispatchState{const job=state.jobs.find(item=>item.id===id);if(!job)return state;const correct=job.resource===resource;const late=state.minute>job.deadline;const reward=correct&&!late?100+job.priority*25:correct?40:-60;return{minute:state.minute+1,score:Math.max(0,state.score+reward),safety:Math.max(0,state.safety-(correct?late?8:0:20)),completed:state.completed+1,jobs:state.jobs.filter(item=>item.id!==id).map(item=>({...item,deadline:item.deadline-1}))}}
export function bestDispatchJob(state:DispatchState){return[...state.jobs].sort((a,b)=>(b.priority-a.priority)||(a.deadline-b.deadline))[0]}
export function dispatchGrade(state:DispatchState){return state.safety>=85&&state.score>=500?"win":state.safety<60?"loss":state.jobs.length?"playing":"loss";}
