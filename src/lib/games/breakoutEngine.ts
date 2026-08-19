/**
 * Breakout — deterministic physics and rules.
 *
 * The game it replaced had no ball and no paddle: the player clicked a column
 * and a brick disappeared. This module is the actual game — a ball with a
 * velocity, a paddle that shapes the bounce angle, bricks with hit points,
 * lives and levels — written as pure functions over an immutable state so the
 * component and the tests share one source of truth.
 *
 * Coordinates are field units, not pixels: 200 wide by 140 tall, origin at the
 * top left. The component scales that box to whatever space it has, so the
 * physics behave identically on a phone and on a desktop.
 */

export type BreakoutStatus = "ready" | "running" | "over" | "won";
export type BreakoutEvent = "launch" | "paddle" | "wall" | "brick" | "break" | "life" | "level" | "win";

export interface BreakoutConfig {
  fieldWidth: number;
  fieldHeight: number;
  paddleWidth: number;
  paddleHeight: number;
  /** Distance from the bottom of the field to the top of the paddle. */
  paddleInset: number;
  ballRadius: number;
  /** Ball speed in field units per second at level 1. */
  baseSpeed: number;
  /** Extra speed per level. */
  speedPerLevel: number;
  /** Field units the paddle travels per second under keyboard control. */
  paddleSpeed: number;
  columns: number;
  /** Brick rows at level 1. Later levels add rows up to `maxRows`. */
  rows: number;
  maxRows: number;
  lives: number;
  /** Levels to clear before the run is won. */
  levels: number;
}

export const BREAKOUT_CONFIG: BreakoutConfig = {
  fieldWidth: 200,
  fieldHeight: 140,
  paddleWidth: 38,
  paddleHeight: 4,
  paddleInset: 8,
  ballRadius: 2.4,
  baseSpeed: 62,
  speedPerLevel: 7,
  paddleSpeed: 130,
  columns: 8,
  rows: 3,
  maxRows: 6,
  lives: 3,
  levels: 5,
};

export interface Brick {
  id: number;
  column: number;
  row: number;
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
}

export interface Ball { x: number; y: number; vx: number; vy: number }

export interface BreakoutState {
  config: BreakoutConfig;
  paddleX: number;
  ball: Ball;
  /** Before launch the ball rides the paddle. */
  attached: boolean;
  bricks: Brick[];
  lives: number;
  score: number;
  level: number;
  /** Bricks broken since the ball last touched the paddle. */
  combo: number;
  bestCombo: number;
  status: BreakoutStatus;
  /** Everything that happened in the last step, for sound and announcements. */
  events: BreakoutEvent[];
  seed: number;
}

const BRICK_MARGIN = 1.2;
const BRICK_TOP = 12;
const BRICK_HEIGHT = 6;

function nextRandom(seed: number): { value: number; seed: number } {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, seed: t };
}

export function paddleY(config: BreakoutConfig): number {
  return config.fieldHeight - config.paddleInset - config.paddleHeight;
}

export function rowsForLevel(config: BreakoutConfig, level: number): number {
  return Math.min(config.maxRows, config.rows + level - 1);
}

export function speedForLevel(config: BreakoutConfig, level: number): number {
  return config.baseSpeed + (level - 1) * config.speedPerLevel;
}

/** Row 0 is the top row and takes the most hits, so depth is worth clearing. */
function hitPointsForRow(row: number, rows: number): number {
  if (rows <= 2) return 1;
  return row === 0 ? 3 : row === 1 ? 2 : 1;
}

export function buildBricks(config: BreakoutConfig, level: number): Brick[] {
  const rows = rowsForLevel(config, level);
  const width = (config.fieldWidth - BRICK_MARGIN * (config.columns + 1)) / config.columns;
  const bricks: Brick[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < config.columns; column += 1) {
      const hp = hitPointsForRow(row, rows);
      bricks.push({
        id: row * config.columns + column,
        column,
        row,
        x: BRICK_MARGIN + column * (width + BRICK_MARGIN),
        y: BRICK_TOP + row * (BRICK_HEIGHT + BRICK_MARGIN),
        width,
        height: BRICK_HEIGHT,
        hp,
        maxHp: hp,
      });
    }
  }
  return bricks;
}

function restingBall(config: BreakoutConfig, paddleX: number): Ball {
  return { x: paddleX, y: paddleY(config) - config.ballRadius - 0.2, vx: 0, vy: 0 };
}

export function createBreakoutState(seed = Date.now(), config: BreakoutConfig = BREAKOUT_CONFIG): BreakoutState {
  const paddleX = config.fieldWidth / 2;
  return {
    config,
    paddleX,
    ball: restingBall(config, paddleX),
    attached: true,
    bricks: buildBricks(config, 1),
    lives: config.lives,
    score: 0,
    level: 1,
    combo: 0,
    bestCombo: 0,
    status: "ready",
    events: [],
    seed,
  };
}

/**
 * Launches the ball. The horizontal component is randomised within a safe cone
 * so the opening is never identical, but never so shallow that the ball crawls
 * along the ceiling.
 */
export function launchBall(state: BreakoutState): BreakoutState {
  if (!state.attached || state.status === "over" || state.status === "won") return state;
  const { value, seed } = nextRandom(state.seed);
  const angle = (-Math.PI / 2) + (value - 0.5) * (Math.PI / 3);
  const speed = speedForLevel(state.config, state.level);
  return {
    ...state,
    seed,
    status: "running",
    attached: false,
    ball: { ...state.ball, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed },
    events: ["launch"],
  };
}

export function movePaddle(state: BreakoutState, x: number): BreakoutState {
  if (state.status === "over" || state.status === "won") return state;
  const half = state.config.paddleWidth / 2;
  const paddleX = Math.min(state.config.fieldWidth - half, Math.max(half, x));
  return {
    ...state,
    paddleX,
    ball: state.attached ? restingBall(state.config, paddleX) : state.ball,
  };
}

function overlaps(ball: Ball, radius: number, brick: Brick): boolean {
  const nearestX = Math.max(brick.x, Math.min(ball.x, brick.x + brick.width));
  const nearestY = Math.max(brick.y, Math.min(ball.y, brick.y + brick.height));
  const dx = ball.x - nearestX;
  const dy = ball.y - nearestY;
  return dx * dx + dy * dy <= radius * radius;
}

/** Points a brick is worth: deeper rows and later levels pay more, and a combo multiplies. */
export function brickValue(state: BreakoutState, brick: Brick): number {
  const depth = Math.max(1, state.config.maxRows - brick.row);
  return (10 + depth * 5) * state.level * (1 + state.combo * 0.25);
}

function loseLife(state: BreakoutState): BreakoutState {
  const lives = state.lives - 1;
  const base: BreakoutState = {
    ...state,
    lives,
    combo: 0,
    attached: true,
    ball: restingBall(state.config, state.paddleX),
    events: [...state.events, "life"],
  };
  return lives <= 0 ? { ...base, status: "over" } : base;
}

function advanceLevel(state: BreakoutState): BreakoutState {
  if (state.level >= state.config.levels) {
    return { ...state, status: "won", events: [...state.events, "win"] };
  }
  const level = state.level + 1;
  return {
    ...state,
    level,
    bricks: buildBricks(state.config, level),
    combo: 0,
    attached: true,
    ball: restingBall(state.config, state.paddleX),
    events: [...state.events, "level"],
  };
}

/**
 * Advances the world by `seconds`.
 *
 * The ball is integrated in sub-steps no longer than a third of its radius, so
 * it can never pass through a brick or the paddle between two frames however
 * long the frame took — the classic tunnelling bug in a naive implementation.
 */
export function stepBreakout(state: BreakoutState, seconds: number, paddleDirection = 0): BreakoutState {
  if (state.status === "over" || state.status === "won") return state;
  if (!Number.isFinite(seconds) || seconds <= 0) return state;

  let next: BreakoutState = { ...state, events: [] };

  if (paddleDirection !== 0) {
    next = movePaddle(next, next.paddleX + paddleDirection * next.config.paddleSpeed * seconds);
  }
  if (next.attached) return next;

  const { config } = next;
  const speed = Math.hypot(next.ball.vx, next.ball.vy) || 1;
  const maxStep = config.ballRadius / 3;
  const slices = Math.max(1, Math.ceil((speed * seconds) / maxStep));
  const slice = seconds / slices;

  for (let i = 0; i < slices && next.status === "running"; i += 1) {
    next = advanceBall(next, slice);
  }
  return next;
}

function advanceBall(state: BreakoutState, seconds: number): BreakoutState {
  const { config } = state;
  const radius = config.ballRadius;
  const events = state.events.slice();
  let { x, y, vx, vy } = state.ball;

  x += vx * seconds;
  y += vy * seconds;

  if (x - radius <= 0) { x = radius; vx = Math.abs(vx); events.push("wall"); }
  else if (x + radius >= config.fieldWidth) { x = config.fieldWidth - radius; vx = -Math.abs(vx); events.push("wall"); }
  if (y - radius <= 0) { y = radius; vy = Math.abs(vy); events.push("wall"); }

  let { bricks, score, combo, bestCombo } = state;
  const hit = bricks.find((brick) => brick.hp > 0 && overlaps({ x, y, vx, vy }, radius, brick));
  if (hit) {
    // Resolve on the axis the ball entered from, so a corner clip does not
    // reverse both components and send the ball back where it came from.
    const fromSide =
      x < hit.x || x > hit.x + hit.width
        ? Math.abs(x - (hit.x + hit.width / 2)) / (hit.width / 2) > Math.abs(y - (hit.y + hit.height / 2)) / (hit.height / 2)
        : false;
    if (fromSide) { vx = -vx; x += vx > 0 ? radius / 2 : -radius / 2; }
    else { vy = -vy; y += vy > 0 ? radius / 2 : -radius / 2; }

    const hp = hit.hp - 1;
    bricks = bricks.map((brick) => (brick.id === hit.id ? { ...brick, hp } : brick));
    events.push(hp <= 0 ? "break" : "brick");
    if (hp <= 0) {
      combo += 1;
      bestCombo = Math.max(bestCombo, combo);
      score += Math.round(brickValue({ ...state, combo: combo - 1 }, hit));
    }
  }

  const top = paddleY(config);
  const half = config.paddleWidth / 2;
  const onPaddleRow = y + radius >= top && y + radius <= top + config.paddleHeight + Math.abs(vy * seconds);
  if (vy > 0 && onPaddleRow && x >= state.paddleX - half - radius && x <= state.paddleX + half + radius) {
    // Where the ball lands on the paddle sets the outgoing angle, which is what
    // turns Breakout from luck into aiming. The offset is floored away from
    // dead centre: a perfectly vertical return locks the ball into one column
    // and the level can never be cleared.
    const raw = Math.max(-1, Math.min(1, (x - state.paddleX) / half));
    const minimum = 0.08;
    const offset = Math.abs(raw) >= minimum ? raw : (raw < 0 || (raw === 0 && vx < 0) ? -minimum : minimum);
    const angle = (-Math.PI / 2) + offset * (Math.PI / 3);
    const speed = Math.max(speedForLevel(config, state.level), Math.hypot(vx, vy));
    vx = Math.cos(angle) * speed;
    vy = Math.sin(angle) * speed;
    y = top - radius - 0.01;
    combo = 0;
    events.push("paddle");
  }

  let next: BreakoutState = { ...state, ball: { x, y, vx, vy }, bricks, score, combo, bestCombo, events };

  if (y - radius > config.fieldHeight) return loseLife(next);
  if (!next.bricks.some((brick) => brick.hp > 0)) next = advanceLevel(next);
  return next;
}

export function bricksRemaining(state: BreakoutState): number {
  return state.bricks.filter((brick) => brick.hp > 0).length;
}

/** Which way the ball is off the paddle, and how soon it arrives. */
export function ballBearing(state: BreakoutState): { side: "left" | "right" | "centred"; distance: number; secondsToPaddle: number | null } {
  const dx = state.ball.x - state.paddleX;
  const gap = paddleY(state.config) - state.ball.y;
  return {
    side: Math.abs(dx) <= state.config.paddleWidth / 2 ? "centred" : dx > 0 ? "right" : "left",
    distance: Math.round(Math.abs(dx)),
    secondsToPaddle: state.ball.vy > 0 && gap > 0 ? Number((gap / state.ball.vy).toFixed(2)) : null,
  };
}

export function describeBreakoutBoard(state: BreakoutState): string {
  if (state.status === "won") return `Run won with ${state.score} points after ${state.config.levels} levels.`;
  if (state.status === "over") return `Game over with ${state.score} points on level ${state.level}.`;

  const bearing = ballBearing(state);
  const parts = [
    `Level ${state.level}. ${bricksRemaining(state)} bricks left. ${state.lives} lives. Score ${state.score}.`,
    `Paddle at column ${Math.round((state.paddleX / state.config.fieldWidth) * 10) + 1} of 11.`,
  ];
  if (state.attached) parts.push("Ball on the paddle. Press Space to launch.");
  else if (bearing.side === "centred") parts.push(`Ball lined up with the paddle${bearing.secondsToPaddle ? `, arriving in ${bearing.secondsToPaddle} seconds` : ""}.`);
  else parts.push(`Ball ${bearing.distance} units to the ${bearing.side}${bearing.secondsToPaddle ? `, arriving in ${bearing.secondsToPaddle} seconds` : ""}. Move ${bearing.side}.`);
  if (state.combo > 1) parts.push(`Combo ${state.combo}.`);
  return parts.join(" ");
}
