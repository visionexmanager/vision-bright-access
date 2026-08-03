export type ResourceState={cash:number;stock:number;capacity:number;quality:number;reputation:number;day:number};
export type ResourceAction="buy"|"upgrade"|"quality"|"operate";
export const initialResourceState=():ResourceState=>({cash:500,stock:4,capacity:2,quality:50,reputation:50,day:1});
const cap=(value:number,min=0,max=100)=>Math.max(min,Math.min(max,value));
export function actionCost(action:ResourceAction,state:ResourceState){if(action==="buy")return 60;if(action==="upgrade")return 100+state.capacity*35;if(action==="quality")return 80;return 0}
export function applyResourceAction(state:ResourceState,action:ResourceAction):ResourceState{const cost=actionCost(action,state);if(state.cash<cost)return state;if(action==="buy")return{...state,cash:state.cash-cost,stock:state.stock+5};if(action==="upgrade")return{...state,cash:state.cash-cost,capacity:state.capacity+1};if(action==="quality")return{...state,cash:state.cash-cost,quality:cap(state.quality+10)};const served=Math.min(state.stock,state.capacity),income=Math.round(served*(35+state.quality*.6)),shortage=served<state.capacity;return{...state,cash:state.cash+income,stock:state.stock-served,reputation:cap(state.reputation+(shortage?-6:3)+(state.quality>=70?2:0)),day:state.day+1}}
export function resourceScore(state:ResourceState){return Math.max(0,Math.round(state.cash+state.quality*8+state.reputation*10+state.capacity*75))}
export function resourceOutcome(state:ResourceState){return state.day>=9&&state.cash>=700&&state.reputation>=55?"win":state.day>=9?"loss":"playing"}
