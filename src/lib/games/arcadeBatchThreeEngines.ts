
export const NONOGRAM_SOLUTION=[[1,0,1,0,1],[1,1,1,1,1],[0,1,1,1,0],[0,0,1,0,0],[0,0,1,0,0]] as const;
export function nonogramComplete(cells:boolean[][]){return NONOGRAM_SOLUTION.every((row,r)=>row.every((value,c)=>Boolean(value)===cells[r][c]));}

export function scoreMastermind(secret:number[],guess:number[]){let exact=0;const remainingSecret:number[]=[];const remainingGuess:number[]=[];secret.forEach((value,index)=>{if(value===guess[index])exact++;else{remainingSecret.push(value);remainingGuess.push(guess[index])}});let color=0;remainingGuess.forEach(value=>{const index=remainingSecret.indexOf(value);if(index>=0){color++;remainingSecret.splice(index,1)}});return {exact,color};}

export const WORD_GRID=["VISIONEX","LEARNING","STRATEGY","MEMORIES","KEYBOARD","PUZZLING","SCIENCES","CREATIVE"] as const;
export const WORD_TARGETS=["VISIONEX","LEARNING","STRATEGY","KEYBOARD","SCIENCE"] as const;
export function wordExists(word:string){const normalized=word.trim().toUpperCase();const lines=[...WORD_GRID,...Array.from({length:8},(_,c)=>WORD_GRID.map(row=>row[c]).join(""))];return lines.some(line=>line.includes(normalized)||[...line].reverse().join("").includes(normalized));}
