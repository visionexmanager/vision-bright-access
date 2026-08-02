import type { ExpansionGroup, PlannedArcadeGame } from "./types";

type Seed = [string, string, ExpansionGroup, PlannedArcadeGame["categories"], PlannedArcadeGame["age"], PlannedArcadeGame["difficulty"], string];
const seeds: Seed[] = [
  ["chess","Chess","Classic",["Classic","Strategy","Accessible"],"Everyone","Hard","10–45"],
  ["checkers","Checkers","Classic",["Classic","Strategy","Accessible"],"Everyone","Medium","8–25"],
  ["solitaire","Solitaire","Classic",["Classic","Strategy","Accessible"],"Everyone","Medium","5–20"],
  ["minesweeper","Minesweeper","Classic",["Classic","Puzzle","Accessible"],"Everyone","Medium","3–15"],
  ["snake","Snake","Classic",["Classic","Action"],"Everyone","Medium","2–10"],
  ["tetris","Block Stacker","Classic",["Classic","Puzzle","Action"],"Everyone","Hard","3–20"],
  ["2048","2048","Classic",["Classic","Puzzle","Strategy","Accessible"],"Everyone","Medium","5–25"],
  ["tic-tac-toe","Tic Tac Toe","Classic",["Classic","Strategy","Kids","Accessible"],"Kids","Easy","1–5"],
  ["connect-four","Connect Four","Classic",["Classic","Strategy","Accessible"],"Everyone","Medium","3–12"],
  ["sudoku","Sudoku","Puzzle",["Puzzle","Educational","Accessible"],"Everyone","Hard","5–30"],
  ["memory-cards-premium","Memory Cards Premium","Puzzle",["Puzzle","Kids","Accessible"],"Kids","Easy","3–12"],
  ["mahjong","Mahjong","Puzzle",["Puzzle","Classic","Strategy"],"Everyone","Hard","10–40"],
  ["word-search","Word Search","Puzzle",["Puzzle","Educational","Accessible"],"Everyone","Medium","5–20"],
  ["crossword","Crossword","Puzzle",["Puzzle","Educational","Accessible"],"Everyone","Hard","10–45"],
  ["jigsaw","Jigsaw Puzzle","Puzzle",["Puzzle","Kids"],"Everyone","Medium","5–30"],
  ["logic-lab","Logic Puzzles","Puzzle",["Puzzle","Educational","Accessible"],"Everyone","Hard","5–25"],
  ["tower-defense","Tower Defense","Strategy",["Strategy","Action"],"Teens","Hard","10–35"],
  ["city-builder-mini","City Builder Mini","Strategy",["Strategy","Educational"],"Everyone","Medium","10–30"],
  ["resource-command","Resource Command","Strategy",["Strategy","Educational"],"Teens","Hard","10–35"],
  ["turn-based-tactics","Turn Based Tactics","Strategy",["Strategy","Multiplayer"],"Teens","Hard","10–40"],
  ["math-arena","Math Arena","Educational",["Educational","Kids","Accessible"],"Kids","Medium","5–15"],
  ["language-journey","Language Journey","Educational",["Educational","Kids","Accessible"],"Kids","Medium","5–20"],
  ["science-quiz","Science Quiz","Educational",["Educational","Accessible"],"Everyone","Medium","5–15"],
  ["geography-quiz","Geography Quiz","Educational",["Educational","Accessible"],"Everyone","Medium","5–15"],
  ["memory-learning","Memory Learning","Educational",["Educational","Kids","Accessible"],"Kids","Easy","5–15"],
  ["learn-colors","Colors Learning","Kids",["Kids","Educational","Accessible"],"Kids","Easy","3–10"],
  ["learn-numbers","Numbers Learning","Kids",["Kids","Educational","Accessible"],"Kids","Easy","3–10"],
  ["learn-letters","Letters Learning","Kids",["Kids","Educational","Accessible"],"Kids","Easy","3–10"],
  ["learn-shapes","Shapes Learning","Kids",["Kids","Educational","Accessible"],"Kids","Easy","3–10"],
  ["matching-studio","Matching Games","Kids",["Kids","Educational","Puzzle","Accessible"],"Kids","Easy","3–12"],
  ["typing-speed","Typing Speed Challenge","Reaction & Skill",["Action","Educational","Accessible"],"Everyone","Medium","2–10"],
  ["reaction-test","Reaction Test","Reaction & Skill",["Action","Accessible"],"Everyone","Medium","1–5"],
  ["memory-challenge","Memory Challenge","Reaction & Skill",["Puzzle","Action","Accessible"],"Everyone","Hard","3–12"],
  ["speed-puzzle","Speed Puzzle","Reaction & Skill",["Puzzle","Action"],"Everyone","Hard","2–10"],
];

const blockedGates = { gameplay:"planned", graphics:"planned", audio:"planned", performance:"planned", accessibility:"planned" } as const;
export const PREMIUM_EXPANSION_PLAN: readonly PlannedArcadeGame[] = seeds.map(([id,name,group,categories,age,difficulty,expectedMinutes]) => ({
  id, name, group, categories, age, difficulty, expectedMinutes, controls:["Keyboard","Touch"],
  future:["multiplayer","challenges","tournaments","ai-opponent"], gates:{ ...blockedGates },
}));
