import type { ArcadeGame } from "../catalog";
import type { PlayerGameData } from "../core/types";

export type ArcadeAIRecommendation = { game: ArcadeGame; reason: string; confidence: number };

/** Privacy-first, explainable recommender. No personal data leaves the device. */
export function recommendGames(games: readonly ArcadeGame[], records: ReadonlyMap<string, PlayerGameData>, limit = 3, preferredAge?: ArcadeGame["age"]): ArcadeAIRecommendation[] {
  const historyCategories = new Set(games.filter(game => (records.get(game.slug)?.playCount ?? 0) > 0).flatMap(game => game.categories));
  const eligible = preferredAge ? games.filter(game => game.age === "Everyone" || game.age === preferredAge) : games;
  return eligible.map((game) => {
    const data = records.get(game.slug);
    const unexplored = data?.playCount ? 0 : 25;
    const accessible = game.accessible ? 20 : 0;
    const learning = game.categories.includes("Educational") ? 12 : 0;
    const historyFit = game.categories.some(category => historyCategories.has(category)) ? 15 : 0;
    const difficultyFit = data && data.completionCount === 0 && game.difficulty === "Hard" ? -15 : 10;
    const score = 40 + unexplored + accessible + learning + historyFit + difficultyFit;
    const reason = unexplored ? "تجربة جديدة مناسبة لملفك" : accessible ? "تدعم الوصول والتحكم الواضح" : "تكمل نمط ألعابك الحالي";
    return { game, reason, confidence: Math.min(95, Math.max(40, score)) };
  }).sort((a,b) => b.confidence - a.confidence || a.game.title.localeCompare(b.game.title)).slice(0, limit);
}

export function difficultyAdvice(data: PlayerGameData) {
  if (data.playCount < 3) return "ابدأ بالمستوى السهل حتى تتعرف إلى التحكم.";
  const completionRate = data.completionCount / data.playCount;
  if (completionRate > 0.75) return "أداؤك ثابت؛ جرّب مستوى أصعب أو تحدياً زمنياً.";
  if (completionRate < 0.3) return "خفّض الصعوبة أو فعّل التعليمات الصوتية.";
  return "المستوى الحالي متوازن مع أدائك.";
}
