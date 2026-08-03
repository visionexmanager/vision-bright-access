export type CrosswordClue={clue:string;answer:string};
export const CROSSWORD_CLUES:CrosswordClue[]=[{clue:"A machine used to enter letters into a computer",answer:"KEYBOARD"},{clue:"The ability to remember information",answer:"MEMORY"},{clue:"A structured challenge with a solution",answer:"PUZZLE"},{clue:"A place to borrow books",answer:"LIBRARY"}];
export function normalizeWord(value:string){return value.trim().toUpperCase().replace(/[^A-Z]/g,"")}
export function checkCrossword(clue:CrosswordClue,value:string){return normalizeWord(value)===clue.answer}
export function isAnagram(source:string,value:string){const sort=(word:string)=>[...normalizeWord(word)].sort().join("");return normalizeWord(value)!==normalizeWord(source)&&sort(source)===sort(value)}
export function validWordStep(from:string,to:string){const a=normalizeWord(from),b=normalizeWord(to);return a.length===b.length&&[...a].filter((letter,index)=>letter!==b[index]).length===1}
export const LADDER_PATH=["COLD","CORD","CARD","WARD","WARM"] as const;
export const SPELLING_WORDS=[{spoken:"accessible",answer:"ACCESSIBLE"},{spoken:"strategy",answer:"STRATEGY"},{spoken:"adventure",answer:"ADVENTURE"},{spoken:"achievement",answer:"ACHIEVEMENT"}] as const;
