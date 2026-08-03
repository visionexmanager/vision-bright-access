export const MUSIC_NOTES = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"] as const;
export type MusicNote = typeof MUSIC_NOTES[number];
const FREQUENCIES: Record<MusicNote, number> = { C4:261.63,D4:293.66,E4:329.63,F4:349.23,G4:392,A4:440,B4:493.88,C5:523.25 };
export function noteFrequency(note:MusicNote){return FREQUENCIES[note]}
export function matchesMelody(target:MusicNote[],input:MusicNote[]){const correctPrefix=input.every((note,index)=>note===target[index]);return{correctPrefix,complete:correctPrefix&&input.length===target.length}}
export function rhythmAccuracy(target:number[],input:number[],tolerance=160){if(target.length!==input.length||!target.length)return 0;const error=target.reduce((sum,beat,index)=>sum+Math.abs(beat-input[index]),0)/target.length;return Math.max(0,Math.round(100-error/tolerance*100))}
export function pianoLessonScore(target:MusicNote[],input:MusicNote[]){if(!target.length)return 0;return Math.round(target.filter((note,index)=>note===input[index]).length/target.length*100)}
export function nextMelody(round:number):MusicNote[]{const length=Math.min(6,2+round);return Array.from({length},(_,index)=>MUSIC_NOTES[(round*2+index*3)%MUSIC_NOTES.length])}
