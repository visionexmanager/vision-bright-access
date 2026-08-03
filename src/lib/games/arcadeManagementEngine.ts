export type ResourceKey="cash"|"people"|"quality"|"capacity";
export type ManagementAction={id:string;label:string;cost:number;effects:Partial<Record<ResourceKey,number>>};
export type ManagementState={turn:number;cash:number;people:number;quality:number;capacity:number;score:number};
export function createManagementState():ManagementState{return{turn:1,cash:500,people:50,quality:50,capacity:20,score:0}}
export function applyManagementAction(state:ManagementState,action:ManagementAction):ManagementState{if(state.cash<action.cost)return state;const next={...state,turn:state.turn+1,cash:state.cash-action.cost,score:state.score+25};for(const[key,value]of Object.entries(action.effects)as[ResourceKey,number][])next[key]=Math.max(0,Math.min(key==="cash"?9999:100,next[key]+value));next.cash+=Math.round((next.people+next.quality+next.capacity)/8);next.score+=Math.round((next.people+next.quality)/10);return next}
export function managementResult(state:ManagementState,maxTurns=8){if(state.cash<=0||state.people<=10||state.quality<=10)return"loss";if(state.turn>maxTurns)return state.score>=300&&state.quality>=55?"win":"loss";return"playing";}
