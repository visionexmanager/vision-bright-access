export type Direction = "up" | "down" | "left" | "right";

export const GRID = 15;

export interface Snake {
  /** Head first; each entry is a `row * GRID + col` index. */
  body: number[];
  direction: Direction;
  food: number;
  score: number;
  alive: boolean;
}

const DELTA: Record<Direction, [number, number]> = {
  up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1],
};

const OPPOSITE: Record<Direction, Direction> = {
  up: "down", down: "up", left: "right", right: "left",
};

export const rowOf = (index: number) => Math.floor(index / GRID);
export const colOf = (index: number) => index % GRID;

/** Places food on a random cell the snake does not occupy. */
export function placeFood(body: number[]): number {
  const taken = new Set(body);
  const free: number[] = [];
  for (let index = 0; index < GRID * GRID; index += 1) {
    if (!taken.has(index)) free.push(index);
  }
  if (free.length === 0) return -1;
  return free[Math.floor(Math.random() * free.length)];
}

export function createSnake(): Snake {
  const middle = Math.floor(GRID / 2);
  const body = [
    middle * GRID + middle,
    middle * GRID + middle - 1,
    middle * GRID + middle - 2,
  ];
  return { body, direction: "right", food: placeFood(body), score: 0, alive: true };
}

/** Ignores reversals into the snake's own neck, which would be instant death. */
export function turn(snake: Snake, direction: Direction): Snake {
  if (snake.body.length > 1 && OPPOSITE[snake.direction] === direction) return snake;
  if (snake.direction === direction) return snake;
  return { ...snake, direction };
}

export function step(snake: Snake): Snake {
  if (!snake.alive) return snake;

  const head = snake.body[0];
  const [dr, dc] = DELTA[snake.direction];
  const row = rowOf(head) + dr;
  const col = colOf(head) + dc;

  if (row < 0 || row >= GRID || col < 0 || col >= GRID) {
    return { ...snake, alive: false };
  }

  const next = row * GRID + col;
  const eating = next === snake.food;
  // The tail vacates its cell on a normal move, so it is not an obstacle.
  const obstacles = eating ? snake.body : snake.body.slice(0, -1);
  if (obstacles.includes(next)) {
    return { ...snake, alive: false };
  }

  const body = [next, ...(eating ? snake.body : snake.body.slice(0, -1))];
  return {
    ...snake,
    body,
    score: eating ? snake.score + 10 : snake.score,
    food: eating ? placeFood(body) : snake.food,
  };
}

export type Level = "calm" | "brisk" | "fast";

/** Milliseconds between steps, shortening slightly as the snake grows. */
export const BASE_SPEED: Record<Level, number> = { calm: 260, brisk: 180, fast: 120 };

export function tickDelay(level: Level, score: number): number {
  return Math.max(70, BASE_SPEED[level] - Math.floor(score / 50) * 10);
}
