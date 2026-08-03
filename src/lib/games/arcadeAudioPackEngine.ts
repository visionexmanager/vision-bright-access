export type AudioCue="high"|"low"|"left"|"right"|"near"|"far"|"short"|"long";
export function nextAudioSequence(current:AudioCue[],cue:AudioCue){return[...current,cue]}
export function checkAudioInput(sequence:AudioCue[],input:AudioCue[]){const index=input.length-1;return{correct:input[index]===sequence[index],complete:input.length===sequence.length&&input.every((cue,i)=>cue===sequence[i])}}
export function echoDistance(delayMs:number){return Math.round((delayMs/1000*343)/2);}
export function rhythmMatches(pattern:number[],input:number[],tolerance=180){return pattern.length===input.length&&pattern.every((beat,index)=>Math.abs(beat-input[index])<=tolerance)}
export function soundHuntScore(target:AudioCue,choice:AudioCue,attempt:number){return target===choice?Math.max(20,120-attempt*20):0}
