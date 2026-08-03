export type ReversiCell=0|1|2; export type ReversiBoard=ReversiCell[][];
const dirs=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
export function createReversi():ReversiBoard{const b:ReversiBoard=Array.from({length:8},()=>Array(8).fill(0));b[3][3]=2;b[3][4]=1;b[4][3]=1;b[4][4]=2;return b}
export function reversiFlips(board:ReversiBoard,row:number,column:number,player:1|2){if(board[row]?.[column])return[] as [number,number][];const other=player===1?2:1;const flips:[number,number][]=[];for(const[dr,dc]of dirs){const line:[number,number][]=[];let r=row+dr,c=column+dc;while(board[r]?.[c]===other){line.push([r,c]);r+=dr;c+=dc}if(line.length&&board[r]?.[c]===player)flips.push(...line)}return flips}
export function playReversi(board:ReversiBoard,row:number,column:number,player:1|2){const flips=reversiFlips(board,row,column,player);if(!flips.length)return board;const next=board.map(r=>[...r]);next[row][column]=player;flips.forEach(([r,c])=>next[r][c]=player);return next}
export function reversiMoves(board:ReversiBoard,player:1|2){const moves:[number,number][]=[];for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(reversiFlips(board,r,c,player).length)moves.push([r,c]);return moves}

export type CheckerCell=0|1|2;export type CheckerBoard=CheckerCell[][];
export function createCheckers():CheckerBoard{return Array.from({length:8},(_,r)=>Array.from({length:8},(_,c)=>(r+c)%2===1?(r<3?2:r>4?1:0):0 as CheckerCell))}
export function checkerMoves(board:CheckerBoard,row:number,column:number,player:1|2){if(board[row]?.[column]!==player)return[] as {row:number;column:number;capture?:[number,number]}[];const step=player===1?-1:1,other=player===1?2:1;const moves:{row:number;column:number;capture?:[number,number]}[]=[];for(const dc of[-1,1]){if(board[row+step]?.[column+dc]===0)moves.push({row:row+step,column:column+dc});else if(board[row+step]?.[column+dc]===other&&board[row+step*2]?.[column+dc*2]===0)moves.push({row:row+step*2,column:column+dc*2,capture:[row+step,column+dc]})}return moves}
export function playChecker(board:CheckerBoard,from:[number,number],to:{row:number;column:number;capture?:[number,number]}){const next=board.map(r=>[...r]);const player=next[from[0]][from[1]];next[from[0]][from[1]]=0;next[to.row][to.column]=player;if(to.capture)next[to.capture[0]][to.capture[1]]=0;return next}

export type PegBoard=(0|1|null)[][];
export function createPegBoard():PegBoard{return [[null,null,1,1,1,null,null],[null,null,1,1,1,null,null],[1,1,1,1,1,1,1],[1,1,1,0,1,1,1],[1,1,1,1,1,1,1],[null,null,1,1,1,null,null],[null,null,1,1,1,null,null]]}
export function pegMoves(board:PegBoard,row:number,column:number){const moves:{row:number;column:number;jumped:[number,number]}[]=[];for(const[dr,dc]of[[-1,0],[1,0],[0,-1],[0,1]])if(board[row+dr]?.[column+dc]===1&&board[row+dr*2]?.[column+dc*2]===0)moves.push({row:row+dr*2,column:column+dc*2,jumped:[row+dr,column+dc]});return moves}
export function playPeg(board:PegBoard,from:[number,number],to:{row:number;column:number;jumped:[number,number]}){const next=board.map(r=>[...r]);next[from[0]][from[1]]=0;next[to.jumped[0]][to.jumped[1]]=0;next[to.row][to.column]=1;return next}

export type ShipCell={ship:boolean;hit:boolean};
export function createFleet(size=7):ShipCell[][]{const board=Array.from({length:size},()=>Array.from({length:size},()=>({ship:false,hit:false})));[[0,0],[0,1],[0,2],[2,4],[3,4],[5,1],[5,2],[5,3]].forEach(([r,c])=>board[r][c].ship=true);return board}
export function fireAt(board:ShipCell[][],row:number,column:number){const next=board.map(r=>r.map(c=>({...c})));next[row][column].hit=true;return next}
