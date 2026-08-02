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
};

export function gameReleaseInfo(gameId:string):GameReleaseInfo { return {...DEFAULT_INFO,...notes[gameId]}; }
