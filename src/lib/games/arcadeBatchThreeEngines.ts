export const SUDOKU_SOLUTION=[[5,3,4,6,7,8,9,1,2],[6,7,2,1,9,5,3,4,8],[1,9,8,3,4,2,5,6,7],[8,5,9,7,6,1,4,2,3],[4,2,6,8,5,3,7,9,1],[7,1,3,9,2,4,8,5,6],[9,6,1,5,3,7,2,8,4],[2,8,7,4,1,9,6,3,5],[3,4,5,2,8,6,1,7,9]] as const;
export const SUDOKU_PUZZLE=[[5,3,0,0,7,0,0,0,0],[6,0,0,1,9,5,0,0,0],[0,9,8,0,0,0,0,6,0],[8,0,0,0,6,0,0,0,3],[4,0,0,8,0,3,0,0,1],[7,0,0,0,2,0,0,0,6],[0,6,0,0,0,0,2,8,0],[0,0,0,4,1,9,0,0,5],[0,0,0,0,8,0,0,7,9]] as const;
export function validSudokuMove(row:number,column:number,value:number){return SUDOKU_SOLUTION[row]?.[column]===value;}

export const NONOGRAM_SOLUTION=[[1,0,1,0,1],[1,1,1,1,1],[0,1,1,1,0],[0,0,1,0,0],[0,0,1,0,0]] as const;
export function nonogramComplete(cells:boolean[][]){return NONOGRAM_SOLUTION.every((row,r)=>row.every((value,c)=>Boolean(value)===cells[r][c]));}

export function scoreMastermind(secret:number[],guess:number[]){let exact=0;const remainingSecret:number[]=[];const remainingGuess:number[]=[];secret.forEach((value,index)=>{if(value===guess[index])exact++;else{remainingSecret.push(value);remainingGuess.push(guess[index])}});let color=0;remainingGuess.forEach(value=>{const index=remainingSecret.indexOf(value);if(index>=0){color++;remainingSecret.splice(index,1)}});return {exact,color};}

export const WORD_GRID=["VISIONEX","LEARNING","STRATEGY","MEMORIES","KEYBOARD","PUZZLING","SCIENCES","CREATIVE"] as const;
export const WORD_TARGETS=["VISIONEX","LEARNING","STRATEGY","KEYBOARD","SCIENCE"] as const;
export function wordExists(word:string){const normalized=word.trim().toUpperCase();const lines=[...WORD_GRID,...Array.from({length:8},(_,c)=>WORD_GRID.map(row=>row[c]).join(""))];return lines.some(line=>line.includes(normalized)||[...line].reverse().join("").includes(normalized));}
