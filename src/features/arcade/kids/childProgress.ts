import { ARCADE_GAMES } from "../catalog";
import { playerGameData } from "../core/playerGameData";

const skills: Record<string, string[]> = {
  memory:["Visual memory","Focus"], "word-puzzle":["Vocabulary","Spelling"], akinator:["Reasoning","Classification"],
  "star-chef":["Sequencing","Reading"], "dream-home":["Creativity","Planning"], "fashion-designer":["Creativity","Color awareness"],
  "quiz-challenge":["General knowledge","Decision making"], "music-ear":["Listening","Pitch recognition"], "laptop-tech":["Problem solving","Technology"],
};

export function getChildProgressSnapshot() {
  const games = ARCADE_GAMES.filter((game) => game.age === "Kids" || game.categories.includes("Kids") || game.categories.includes("Educational"));
  const records = games.map((game) => ({ game, data:playerGameData.get(game.slug), skills:skills[game.slug] ?? ["Problem solving"] }));
  const totalSeconds = records.reduce((sum, item) => sum + item.data.totalPlaySeconds, 0);
  const completedGames = records.filter((item) => item.data.completionCount > 0).length;
  const stars = records.reduce((sum, item) => sum + Math.min(5, item.data.completionCount), 0);
  const earnedSkills = [...new Set(records.filter((item) => item.data.completionCount > 0).flatMap((item) => item.skills))];
  return { records, totalSeconds, completedGames, stars, earnedSkills, level:Math.max(1, Math.floor(stars / 5) + 1) };
}
