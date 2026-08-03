export type GameReleaseInfo = { updatedAt:string; version:string; howToPlay:string[]; changes:string[] };

const DEFAULT_INFO: GameReleaseInfo = {
  updatedAt:"2026-08-02", version:"2.0.0-rc.1",
  howToPlay:["Read the objective before starting.","Use the keyboard or touch controls shown on the game page.","Complete the round to submit a result for server verification."],
  changes:["Unified Visionex Arcade experience.","Secure result-session integration.","Improved keyboard focus, settings, statistics and responsive layout."],
};

const notes: Record<string,Partial<GameReleaseInfo>> = {
  "quiz-challenge":{howToPlay:["Choose the best answer before time expires.","Use Tab and Enter, or the answer shortcut keys.","Build a streak to improve the final score."]},
  memory:{howToPlay:["Reveal two cards using Tab and Enter.","Remember their positions and match every pair.","Finish with fewer moves for a better result."]},
  "word-puzzle":{howToPlay:["Read the available letters and clue.","Enter a valid word with the keyboard.","Complete the puzzle before time expires."]},
  "velocity-racing":{howToPlay:["Use the arrow keys or touch controls to steer.","Avoid obstacles and reach checkpoints.","Finish the course to submit the run."]},
  visionopoly:{howToPlay:["Roll, move and manage properties.","Buy, trade and mortgage strategically.","Win by remaining solvent against the opponents."]},
  "2048":{updatedAt:"2026-08-03",version:"1.0.0",howToPlay:["Use the arrow keys or the on-screen direction controls.","Equal adjacent tiles merge once per move.","Create the 2048 tile to complete the achievement."],changes:["Deterministic tested merge engine.","Complete keyboard and touch controls.","Screen-reader status announcements and secure scoring."]},
  minesweeper:{updatedAt:"2026-08-03",version:"1.0.0",howToPlay:["Reveal a cell with Enter, Space, touch, or pointer input.","Press F on the focused cell to place or remove a flag.","Reveal every safe cell without selecting a mine."],changes:["Flood-reveal engine with unit tests.","Full grid labels for assistive technology.","Responsive nine-by-nine production board."]},
  "connect-four":{updatedAt:"2026-08-03",version:"1.0.0",howToPlay:["Choose any cell in the column where you want to drop a disc.","The computer responds with a tactical move.","Connect four discs horizontally, vertically, or diagonally."],changes:["Tested win-detection engine.","Keyboard-operable semantic game grid.","Responsive tactical computer opponent."]},
  "reaction-test":{updatedAt:"2026-08-03",version:"1.0.0",howToPlay:["Start the test and wait without pressing.","Activate the large test area as soon as the Go signal appears.","Finish below 350 milliseconds to complete the achievement."],changes:["Fair randomized signal delay.","Visual and assistive-audio feedback.","Keyboard, touch, and pointer parity."]},
};

export function gameReleaseInfo(gameId:string):GameReleaseInfo { return {...DEFAULT_INFO,...notes[gameId]}; }
