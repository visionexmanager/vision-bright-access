/**
 * Snake — deterministic game engine.
 *
 * Every rule lives here as a pure function over an immutable state, so the
 * component renders and the tests reason about exactly the same logic. The
 * random number generator is seeded, which makes a whole round reproducible
 * from its seed: a reported bug can be replayed, and the tests never flake.
 */

export type Direction = "up" | "down" | "left" | "right";
export type SnakeStatus = "ready" | "running" | "over" | "won";
export interface Point { x: number; y: number }

export interface SnakeConfig {
  /** Square board edge, in cells. */
  size: number;
  /** Food needed to finish the round. */
  target: number;
  /** Food eaten per level. */
  foodPerLevel: number;
  /** Tick length at level 1, in milliseconds. */
  startStepMs: number;
  /** Fastest the board is ever allowed to get. */
  minStepMs: number;
  /** Milliseconds shaved off the tick per level. */
  stepMsPerLevel: number;
  /** First level that starts placing walls. */
  obstacleFromLevel: number;
}

export const SNAKE_CONFIG: SnakeConfig = {
  size: 12,
  target: 30,
  foodPerLevel: 5,
  startStepMs: 320,
  minStepMs: 110,
  stepMsPerLevel: 30,
  obstacleFromLevel: 3,
};

export interface SnakeState {
  config: SnakeConfig;
  /** Head first. */
  snake: Point[];
  /** The direction the last completed tick travelled in. */
  direction: Direction;
  /** Turns accepted but not yet applied, oldest first. At most two. */
  queued: Direction[];
  food: Point;
  obstacles: Point[];
  score: number;
  level: number;
  foodEaten: number;
  /** Ticks since the last food, used for the freshness bonus. */
  ticksSinceFood: number;
  /** Points added by the most recent bite, for HUD feedback. */
  lastGain: number;
  status: SnakeStatus;
  /** Why the round ended. */
  cause?: "wall" | "self" | "obstacle";
  seed: number;
}

const OFFSETS: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

/** mulberry32 — small, fast and stable across engines. */
function nextRandom(seed: number): { value: number; seed: number } {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, seed: t };
}

const samePoint = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
const contains = (points: readonly Point[], point: Point) => points.some((item) => samePoint(item, point));

/** Tick length for a level, clamped so the board never becomes unplayable. */
export function stepDurationMs(state: SnakeState): number {
  const { startStepMs, stepMsPerLevel, minStepMs } = state.config;
  return Math.max(minStepMs, startStepMs - (state.level - 1) * stepMsPerLevel);
}

/** Every cell not occupied by the snake, a wall or anything excluded. */
function freeCells(state: Pick<SnakeState, "config" | "snake" | "obstacles">, exclude: Point[] = []): Point[] {
  const cells: Point[] = [];
  for (let y = 0; y < state.config.size; y += 1) {
    for (let x = 0; x < state.config.size; x += 1) {
      const point = { x, y };
      if (contains(state.snake, point) || contains(state.obstacles, point) || contains(exclude, point)) continue;
      cells.push(point);
    }
  }
  return cells;
}

/**
 * Places food on a free cell. The previous implementation walked a fixed
 * diagonal, so food could land inside the snake and every round repeated the
 * same sequence.
 */
function placeFood(state: SnakeState, exclude: Point[] = []): { food: Point; seed: number } {
  const options = freeCells(state, exclude);
  if (!options.length) return { food: state.food, seed: state.seed };
  const { value, seed } = nextRandom(state.seed);
  return { food: options[Math.floor(value * options.length)], seed };
}

function placeObstacle(state: SnakeState): { obstacle?: Point; seed: number } {
  // Never wall in the cells straight ahead of the head, which would make the
  // new level unwinnable through no fault of the player.
  const ahead = [1, 2, 3].map((distance) => ({
    x: state.snake[0].x + OFFSETS[state.direction].x * distance,
    y: state.snake[0].y + OFFSETS[state.direction].y * distance,
  }));
  const options = freeCells(state, [state.food, ...ahead]);
  if (!options.length) return { seed: state.seed };
  const { value, seed } = nextRandom(state.seed);
  return { obstacle: options[Math.floor(value * options.length)], seed };
}

export function createSnakeState(seed = Date.now(), config: SnakeConfig = SNAKE_CONFIG): SnakeState {
  const middle = Math.floor(config.size / 2);
  const base: SnakeState = {
    config,
    snake: [
      { x: middle, y: middle },
      { x: middle - 1, y: middle },
      { x: middle - 2, y: middle },
    ],
    direction: "right",
    queued: [],
    food: { x: middle + 3, y: middle },
    obstacles: [],
    score: 0,
    level: 1,
    foodEaten: 0,
    ticksSinceFood: 0,
    lastGain: 0,
    status: "ready",
    seed,
  };
  const placed = placeFood(base);
  return { ...base, food: placed.food, seed: placed.seed };
}

export function startSnake(state: SnakeState): SnakeState {
  return state.status === "ready" ? { ...state, status: "running" } : state;
}

/**
 * Accepts a turn unless it reverses the direction the snake will be travelling
 * in when the turn lands.
 *
 * Two defects live here in a naive implementation: reversing into your own neck
 * ended the round instantly, and pressing two keys inside one tick let the
 * second reverse the first. Queueing turns and validating each against the
 * previous queued turn fixes both, and keeps the fast double-tap corner that
 * experienced players expect.
 */
export function queueTurn(state: SnakeState, direction: Direction): SnakeState {
  if (state.status !== "running" && state.status !== "ready") return state;
  if (state.queued.length >= 2) return state;
  const last = state.queued.length ? state.queued[state.queued.length - 1] : state.direction;
  if (direction === last || direction === OPPOSITE[last]) return state;
  return { ...state, queued: [...state.queued, direction] };
}

/** What a bite is worth right now: level value plus a freshness bonus. */
export function biteValue(state: SnakeState): number {
  const freshness = Math.max(0, 40 - state.ticksSinceFood * 2);
  return 10 * state.level + freshness;
}

export function stepSnake(state: SnakeState): SnakeState {
  if (state.status !== "running") return state;

  const [direction, ...rest] = state.queued.length ? state.queued : [state.direction];
  const queued = state.queued.length ? rest : [];
  const offset = OFFSETS[direction];
  const head = { x: state.snake[0].x + offset.x, y: state.snake[0].y + offset.y };

  if (head.x < 0 || head.y < 0 || head.x >= state.config.size || head.y >= state.config.size) {
    return { ...state, direction, queued, status: "over", cause: "wall" };
  }
  if (contains(state.obstacles, head)) {
    return { ...state, direction, queued, status: "over", cause: "obstacle" };
  }

  const ate = samePoint(head, state.food);
  // The tail cell frees up on the same tick unless the snake grows into it.
  const body = ate ? state.snake : state.snake.slice(0, -1);
  if (contains(body, head)) {
    return { ...state, direction, queued, status: "over", cause: "self" };
  }

  const snake = [head, ...body];
  if (!ate) {
    return { ...state, snake, direction, queued, ticksSinceFood: state.ticksSinceFood + 1, lastGain: 0 };
  }

  const gain = biteValue(state);
  const foodEaten = state.foodEaten + 1;
  const level = Math.min(
    Math.floor(foodEaten / state.config.foodPerLevel) + 1,
    Math.floor(state.config.target / state.config.foodPerLevel) + 1,
  );
  const levelledUp = level > state.level;

  let next: SnakeState = {
    ...state,
    snake,
    direction,
    queued,
    score: state.score + gain,
    lastGain: gain,
    foodEaten,
    level,
    ticksSinceFood: 0,
  };

  if (levelledUp && level >= state.config.obstacleFromLevel) {
    const { obstacle, seed } = placeObstacle(next);
    next = { ...next, seed, obstacles: obstacle ? [...next.obstacles, obstacle] : next.obstacles };
  }

  if (foodEaten >= state.config.target) {
    return { ...next, status: "won" };
  }

  const placed = placeFood(next);
  return { ...next, food: placed.food, seed: placed.seed };
}

/**
 * How far the food is from the head and which way to turn for it. This drives
 * the spoken guidance that makes the game playable without seeing the board.
 */
export function foodBearing(state: SnakeState): {
  horizontal: "left" | "right" | "aligned";
  vertical: "up" | "down" | "aligned";
  distance: number;
} {
  const [head] = state.snake;
  const dx = state.food.x - head.x;
  const dy = state.food.y - head.y;
  return {
    horizontal: dx === 0 ? "aligned" : dx > 0 ? "right" : "left",
    vertical: dy === 0 ? "aligned" : dy > 0 ? "down" : "up",
    distance: Math.abs(dx) + Math.abs(dy),
  };
}

/** True when the cell straight ahead would end the round. */
export function dangerAhead(state: SnakeState): boolean {
  const direction = state.queued.length ? state.queued[0] : state.direction;
  const offset = OFFSETS[direction];
  const next = { x: state.snake[0].x + offset.x, y: state.snake[0].y + offset.y };
  if (next.x < 0 || next.y < 0 || next.x >= state.config.size || next.y >= state.config.size) return true;
  return contains(state.obstacles, next) || contains(state.snake.slice(0, -1), next);
}

const END_REASON: Record<NonNullable<SnakeState["cause"]>, string> = {
  wall: "you hit the edge of the board",
  self: "you ran into yourself",
  obstacle: "you hit a wall block",
};

export function describeSnakeBoard(state: SnakeState): string {
  const [head] = state.snake;
  const bearing = foodBearing(state);

  // A finished round must say so first. Reading out a live board summary after
  // the round has ended tells a player who cannot see the screen nothing about
  // why they stopped moving.
  if (state.status === "won") {
    return `Round won with ${state.score} points at level ${state.level}. Length ${state.snake.length}.`;
  }
  if (state.status === "over") {
    return `Round over: ${END_REASON[state.cause ?? "wall"]}. ${state.score} points at level ${state.level}.`;
  }

  const heading = [
    bearing.vertical === "aligned" ? "" : bearing.vertical,
    bearing.horizontal === "aligned" ? "" : bearing.horizontal,
  ].filter(Boolean).join(" and ");
  const parts = [
    `Head at column ${head.x + 1}, row ${head.y + 1}.`,
    // Which way you are already travelling is the one thing a player who
    // cannot see the board has no other way to recover.
    `Heading ${state.queued.length ? state.queued[0] : state.direction}.`,
    `Length ${state.snake.length}.`,
    bearing.distance === 0 ? "Food reached." : `Food ${bearing.distance} cells away, ${heading}.`,
    `Level ${state.level}, score ${state.score}.`,
  ];
  if (state.obstacles.length) parts.push(`${state.obstacles.length} walls on the board.`);
  if (dangerAhead(state)) parts.push("Warning: turn now, the cell ahead is blocked.");
  return parts.join(" ");
}
