/** Fisher-Yates. Shared so every quiz game shuffles its options the same way. */
export function shuffle<T>(arr: readonly T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Picks `count - 1` distractors from `pool` plus the answer, shuffled. */
export function optionsWithAnswer(answer: string, pool: readonly string[], count = 4): string[] {
  const distractors = shuffle(pool.filter((p) => p !== answer)).slice(0, Math.max(0, count - 1));
  return shuffle([answer, ...distractors]);
}
