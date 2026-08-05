import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useGameEconomy } from "@/components/game/GameEconomyGate";
import { gameManager } from "@/features/arcade/core/gameManager";
import { availableRaceTokens, createHexBoard, createLudo, createMancala, createUr, hasHexPath, mancalaFinished, moveRaceToken, playHex, playMancala, type HexBoard, type RaceState } from "@/lib/games/arcadeHeritageBoardEngine";

const panel = "mx-auto max-w-3xl space-y-6 p-4 sm:p-8";

export function Hex() {
  const [board,setBoard]=useState<HexBoard>(()=>createHexBoard(5));
  const [message,setMessage]=useState("Connect cyan from left to right");
  const {settleGameResult}=useGameEconomy();
  const play=(row:number,column:number)=>{
    let next=playHex(board,row,column,1); if(next===board){setMessage("That cell is occupied");return;}
    if(hasHexPath(next,1)){setBoard(next);gameManager.recordScore(1400);setMessage("Connected path complete");void settleGameResult("win","Hex");return;}
    outer:for(let r=0;r<5;r++)for(let c=0;c<5;c++)if(next[r][c]===0){next=playHex(next,r,c,2);break outer;}
    setBoard(next); if(hasHexPath(next,2)){setMessage("Computer completed a path");void settleGameResult("loss","Hex");}else setMessage("Computer moved. Your turn");
  };
  return <main className={panel}><h1 className="text-3xl font-black">Hex</h1><p>Connect the left and right edges. The computer connects top to bottom.</p><div role="grid" aria-label="Five by five Hex board" className="grid grid-cols-5 gap-2 rounded-2xl bg-slate-950 p-4">{board.flatMap((line,row)=>line.map((cell,column)=><button key={`${row}-${column}`} role="gridcell" onClick={()=>play(row,column)} aria-label={`Row ${row+1}, column ${column+1}: ${cell===1?"your cyan stone":cell===2?"computer violet stone":"empty"}`} className={`aspect-square rounded-full border-2 ${cell===1?"border-cyan-100 bg-cyan-500":cell===2?"border-violet-200 bg-violet-700":"border-white/30 bg-white/10"}`}/>))}</div><p role="status" aria-live="polite">{message}</p></main>;
}

export function Mancala(){
  const[state,setState]=useState(createMancala);const[message,setMessage]=useState("Choose one of your six pits");const{settleGameResult}=useGameEconomy();
  const play=(pit:number)=>{let next=playMancala(state,pit);if(next===state){setMessage("Choose a non-empty pit on your side");return;}let safety=12;while(next.current===1&&!mancalaFinished(next)&&safety--){const ai=next.pits.slice(7,13).findIndex(value=>value>0);if(ai<0)break;next=playMancala(next,ai+7);}setState(next);const mine=next.pits[6],theirs=next.pits[13];gameManager.recordScore(mine*100);setMessage(`Stores: you ${mine}, computer ${theirs}`);if(mancalaFinished(next)){const result=mine===theirs?"draw":mine>theirs?"win":"loss";void settleGameResult(result,"Mancala");}};
  return <main className={panel}><h1 className="text-3xl font-black">Mancala</h1><p>Sow every stone counter-clockwise. Landing in your store grants another turn; an empty final pit can capture its opposite.</p><div className="grid grid-cols-6 gap-2 rounded-2xl bg-amber-950 p-4">{state.pits.slice(0,6).map((stones,pit)=><Button key={pit} variant="outline" className="min-h-20" onClick={()=>play(pit)} aria-label={`Your pit ${pit+1}, ${stones} stones`}>{stones}</Button>)}</div><p aria-label={`Your store ${state.pits[6]}, computer store ${state.pits[13]}`}>Your store: {state.pits[6]} · Computer: {state.pits[13]}</p><p role="status" aria-live="polite">{message}</p></main>;
}

function RaceGame({title,finish,pieces,enterOnSix,rollMax}:{title:string;finish:number;pieces:3|4;enterOnSix:boolean;rollMax:number}){
  const initial=useMemo(()=>pieces===4?createLudo():createUr(),[pieces]);const[state,setState]=useState<RaceState>(initial);const[roll,setRoll]=useState(0);const[message,setMessage]=useState(`Roll to begin ${title}`);const{settleGameResult}=useGameEconomy();
  const rollDice=()=>{if(roll)return;const value=1+Math.floor(Math.random()*rollMax);setRoll(value);setMessage(`You rolled ${value}. Choose a legal piece`);};
  const move=(token:number)=>{if(!roll)return;let next=moveRaceToken(state,"player",token,roll,finish,enterOnSix);if(next===state){setMessage("That piece cannot move");return;}if(next.player.every(value=>value===finish)){setState(next);gameManager.recordScore(1800);setMessage(`${title} complete`);void settleGameResult("win",title);return;}const aiRoll=1+Math.floor(Math.random()*rollMax),legal=availableRaceTokens(next,"computer",aiRoll,finish,enterOnSix);if(legal.length)next=moveRaceToken(next,"computer",legal[0],aiRoll,finish,enterOnSix);next={...next,turn:"player"};setState(next);setRoll(0);setMessage(`Computer rolled ${aiRoll}. Your turn`);if(next.computer.every(value=>value===finish))void settleGameResult("loss",title);};
  return <main className={panel}><header className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-black">{title}</h1><Button onClick={rollDice} disabled={roll>0}>Roll {rollMax===4?"four shells":"die"}</Button></header><p>Move every piece from home to position {finish}. Exact rolls are required to finish; occupied unsafe positions capture opposing pieces.</p><div className="grid gap-3 sm:grid-cols-2">{state.player.map((position,index)=><Button key={index} variant="outline" className="min-h-16" disabled={!roll||!availableRaceTokens(state,"player",roll,finish,enterOnSix).includes(index)} onClick={()=>move(index)} aria-label={`Piece ${index+1}, ${position<0?"at home":position===finish?"finished":`position ${position}`}`}>Piece {index+1}: {position<0?"Home":position===finish?"Finished":position}</Button>)}</div><p role="status" aria-live="polite">{message}</p></main>;
}
export const Ludo=()=> <RaceGame title="Ludo" finish={40} pieces={4} enterOnSix rollMax={6}/>;
export const RoyalGameOfUr=()=> <RaceGame title="Royal Game of Ur" finish={14} pieces={3} enterOnSix={false} rollMax={4}/>;
