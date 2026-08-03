export type Mark = "X" | "O" | null;
export type TicBoard = Mark[];

export function ticWinner(board:TicBoard):Mark {
  const lines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for(const [a,b,c] of lines) if(board[a]&&board[a]===board[b]&&board[a]===board[c]) return board[a];
  return null;
}

export function chooseTicMove(board:TicBoard):number {
  for(const mark of ["O","X"] as const) for(let index=0;index<9;index++) if(!board[index]){const trial=[...board];trial[index]=mark;if(ticWinner(trial)===mark)return index;}
  return [4,0,2,6,8,1,3,5,7].find(index=>!board[index])??-1;
}

export type MathOperation = "+" | "−" | "×";
export type MathQuestion = { left:number; right:number; operation:MathOperation; answer:number };
export function createMathQuestion(level:number,random=Math.random):MathQuestion {
  const operations:MathOperation[]=["+","−","×"]; const operation=operations[Math.min(2,Math.floor(level/4))];
  const limit=operation==="×"?12:Math.min(50,10+level*4); let left=1+Math.floor(random()*limit);let right=1+Math.floor(random()*limit);
  if(operation==="−"&&right>left)[left,right]=[right,left];
  return {left,right,operation,answer:operation==="+"?left+right:operation==="−"?left-right:left*right};
}

export type MazePoint={row:number;column:number};
export const AUDIO_MAZE=[
  [0,0,1,0,0,0,1], [1,0,1,0,1,0,1], [0,0,0,0,1,0,0], [0,1,1,0,1,1,0], [0,0,0,0,0,0,0], [0,1,0,1,1,1,0], [0,1,0,0,0,0,0],
] as const;
export function moveMaze(point:MazePoint,direction:"up"|"down"|"left"|"right") {
  const delta={up:[-1,0],down:[1,0],left:[0,-1],right:[0,1]}[direction]; const row=point.row+delta[0],column=point.column+delta[1];
  return AUDIO_MAZE[row]?.[column]===0?{row,column}:point;
}
