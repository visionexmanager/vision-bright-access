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
const originalPlan: PlannedArcadeGame[] = seeds.map(([id,name,group,categories,age,difficulty,expectedMinutes]) => ({
  id, name, group, categories, age, difficulty, expectedMinutes, controls:["Keyboard","Touch"],
  future:["multiplayer","challenges","tournaments","ai-opponent"], gates:{ ...blockedGates },
}));

const roadmapPacks: [PlannedArcadeGame["group"], string[]][] = [
  ["Classic",["Backgammon","Spider Solitaire","FreeCell","Breakout","Arkanoid","Bubble Shooter","Peg Solitaire"]],
  ["Puzzle",["Nonogram","Mastermind","Escape Room","Crystal Jigsaw","Pipe Network","Number Link","Pattern Vault"]],
  ["Board",["Battleship","Ludo","Reversi","Hex","Nine Men's Morris","Mancala","Royal Game of Ur"]],
  ["Card",["UNO Style","Hearts","Spades","Gin Rummy","Blackjack Strategy","Pyramid Solitaire","Golf Solitaire"]],
  ["Educational",["History Quiz","Science Lab","Geography Explorer","Language Builder","Financial Literacy","Coding Basics","World Cultures"]],
  ["Kids",["Shape Safari","Color Garden","Letter Train","Number Friends","Safe Road Adventure","Animal Habitats","Creative Patterns"]],
  ["Typing",["Typing Adventure","Keyboard Navigator","Code Typist","Word Sprint","Typing Defender","Home Row Master","Accessible Dictation"]],
  ["Memory",["Simon Says","Audio Memory","Sequence Vault","Face Recall","Map Memory","Sound Pairs","Pattern Recall"]],
  ["Word",["Hangman Plus","Anagram Arena","Vocabulary Quest","Word Ladder","Synonym Sprint","Spelling Master","Hidden Phrase"]],
  ["Math",["Math Challenge","Fraction Factory","Algebra Sprint","Geometry Lab","Mental Math","Equation Balance","Number Sequence"]],
  ["Logic",["Logic Gates","Deduction Grid","Binary Puzzle","Bridge Builder Logic","Circuit Solver","Truth Table","Safe Cracker"]],
  ["Quiz",["Trivia","Movie Trivia","Music Trivia","Nature Quiz","Technology Quiz","Sports Quiz","Space Quiz"]],
  ["Reaction",["Color Match","Reflex Grid","Signal Sprint","Precision Tap","Quick Choice","Focus Shift","Timing Master"]],
  ["Arcade",["Snake Neon","Tetris Sprint","Meteor Dash","Orb Collector","Laser Grid","Neon Hopper","Pixel Defender"]],
  ["Adventure",["Space Explorer","Maze Runner","Temple Map","Ocean Expedition","Lost Observatory","Desert Caravan","Arctic Mission"]],
  ["Platform",["Sky Steps","Gravity Runner","Cave Climber","Moon Platformer","Tower Ascent","Rooftop Relay","Forest Leap"]],
  ["Racing",["Parking Challenge","City Circuit","Rally Navigator","Kart Time Trial","Drone Racing","Boat Sprint","Train Race"]],
  ["Sports",["Mini Golf","Bowling","Air Hockey","Table Tennis","Penalty Shootout","Basketball Challenge","Archery","Darts","Fishing"]],
  ["Physics",["Balance Lab","Gravity Golf","Pendulum Puzzle","Trajectory Master","Magnet Lab","Bridge Physics","Orbital Motion"]],
  ["Simulation",["Airport Manager","Traffic Control","Train Dispatcher","Harbor Manager","Delivery Simulator","Hospital Flow","Power Grid"]],
  ["Idle",["Space Colony Idle","Museum Curator Idle","Research Lab Idle","Garden Idle","Transit Idle","Ocean Cleanup Idle","Library Idle"]],
  ["Strategy",["Resource Command","Turn Based Tactics","Island Governor","Fleet Command","Diplomacy Table","Supply Lines","Kingdom Planner"]],
  ["Tower Defense",["Castle Defense","Cyber Defense","Forest Guardians","Space Station Defense","Harbor Defense","Museum Defense","Crystal Defense"]],
  ["City Builder",["City Builder","Eco City","Coastal City","Smart City","Mountain Town","Transit City","Accessible City Planner"]],
  ["Business Simulation",["Restaurant Manager","Farm Manager","Factory Manager","Hotel Manager","Retail Manager","Startup Studio","Logistics Company"]],
  ["Cooking",["Cooking Challenge","Bakery Rush","World Kitchen","Recipe Memory","Cafe Manager","Healthy Plate","Chef Timing"]],
  ["Music",["Rhythm Keys","Melody Memory","Beat Matcher","Piano Trainer","Chord Quest","Tempo Test","Sound Studio"]],
  ["Drawing",["Drawing Studio","Symmetry Sketch","Pixel Canvas","Shape Designer","Color Composer","Pattern Artist","Accessible Doodle"]],
  ["Accessible",["Audio Direction","Blind Maze","Voice Quiz","Audio Navigator","Sound Hunt","Keyboard Escape","Spatial Audio Quest"]],
  ["Audio",["Echo Locator","Audio Simon","Soundscape Explorer","Tone Sequence","Audio Traffic","Voice Adventure","Rhythm Navigation"]],
  ["Multiplayer",["Checkers Arena","Quiz Duel","Word Duel","Four Player Ludo","Chess Arena","Team Trivia","Co-op Escape"]],
];

const slugify=(name:string)=>name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"");
const plannedIds=new Set(originalPlan.map(game=>game.id));
const roadmap:PlannedArcadeGame[]=roadmapPacks.flatMap(([group,names])=>names.map(name=>({
  id:slugify(name),name,group,categories:[group === "Reaction & Skill" ? "Reaction" : group],age:group==="Kids"?"Kids":"Everyone",difficulty:"Medium",expectedMinutes:"5–25",controls:["Keyboard","Touch"],future:["multiplayer","challenges","tournaments","ai-opponent"],gates:{...blockedGates},
} as PlannedArcadeGame))).filter(game=>!plannedIds.has(game.id));

export const PREMIUM_EXPANSION_PLAN: readonly PlannedArcadeGame[] = [...originalPlan,...roadmap];
