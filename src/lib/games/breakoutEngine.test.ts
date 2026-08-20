import { describe, expect, it } from "vitest";
import {
  BREAKOUT_CONFIG,
  bricksRemaining,
  buildBricks,
  createBreakoutState,
  describeBreakoutBoard,
  launchBall,
  movePaddle,
  paddleY,
  rowsForLevel,
  speedForLevel,
  stepBreakout,
  type BreakoutState,
} from "./breakoutEngine";

const ready = () => createBreakoutState(11);
const running = () => launchBall(ready());

/** Runs the world forward in realistic 16 ms frames. */
const play = (state: BreakoutState, frames: number, direction = 0) => {
  let current = state;
  for (let i = 0; i < frames; i += 1) current = stepBreakout(current, 1 / 60, direction);
  return current;
};

describe("breakout engine — setup", () => {
  it("opens with the ball resting on the paddle and every life intact", () => {
    const state = ready();
    expect(state.attached).toBe(true);
    expect(state.status).toBe("ready");
    expect(state.lives).toBe(BREAKOUT_CONFIG.lives);
    expect(state.ball.vx).toBe(0);
    expect(state.ball.vy).toBe(0);
  });

  it("does not move before the ball is launched", () => {
    const state = ready();
    expect(play(state, 30).ball).toEqual(state.ball);
  });

  it("builds a full brick wall inside the field", () => {
    const bricks = buildBricks(BREAKOUT_CONFIG, 1);
    expect(bricks).toHaveLength(BREAKOUT_CONFIG.columns * BREAKOUT_CONFIG.rows);
    for (const brick of bricks) {
      expect(brick.x).toBeGreaterThanOrEqual(0);
      expect(brick.x + brick.width).toBeLessThanOrEqual(BREAKOUT_CONFIG.fieldWidth);
    }
  });

  it("makes the top rows take more hits than the bottom one", () => {
    const bricks = buildBricks(BREAKOUT_CONFIG, 1);
    expect(bricks.find((brick) => brick.row === 0)!.hp).toBeGreaterThan(bricks.find((brick) => brick.row === 2)!.hp);
  });

  it("adds rows and speed for later levels, up to the configured ceiling", () => {
    expect(rowsForLevel(BREAKOUT_CONFIG, 2)).toBeGreaterThan(rowsForLevel(BREAKOUT_CONFIG, 1));
    expect(rowsForLevel(BREAKOUT_CONFIG, 50)).toBe(BREAKOUT_CONFIG.maxRows);
    expect(speedForLevel(BREAKOUT_CONFIG, 3)).toBeGreaterThan(speedForLevel(BREAKOUT_CONFIG, 1));
  });

  it("launches upwards, never sideways along the ceiling", () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const ball = launchBall(createBreakoutState(seed)).ball;
      expect(ball.vy).toBeLessThan(0);
      expect(Math.abs(ball.vy)).toBeGreaterThan(Math.abs(ball.vx) * 0.5);
    }
  });
});

describe("breakout engine — paddle", () => {
  it("keeps the paddle inside the field", () => {
    const half = BREAKOUT_CONFIG.paddleWidth / 2;
    expect(movePaddle(ready(), -500).paddleX).toBe(half);
    expect(movePaddle(ready(), 500).paddleX).toBe(BREAKOUT_CONFIG.fieldWidth - half);
  });

  it("carries the resting ball with it before launch", () => {
    const state = movePaddle(ready(), 40);
    expect(state.ball.x).toBe(40);
  });

  it("moves under keyboard direction and stops at the wall", () => {
    const half = BREAKOUT_CONFIG.paddleWidth / 2;
    const nudged = play(ready(), 6, 1);
    expect(nudged.paddleX).toBeCloseTo(BREAKOUT_CONFIG.fieldWidth / 2 + BREAKOUT_CONFIG.paddleSpeed * 0.1, 0);
    expect(play(ready(), 120, 1).paddleX).toBe(BREAKOUT_CONFIG.fieldWidth - half);
  });

  it("bounces the ball back up and shapes the angle by where it lands", () => {
    const base = running();
    const top = paddleY(BREAKOUT_CONFIG);
    const falling = (offset: number): BreakoutState => ({
      ...base,
      paddleX: 100,
      ball: { x: 100 + offset, y: top - BREAKOUT_CONFIG.ballRadius - 0.2, vx: 0, vy: 50 },
    });

    const centre = stepBreakout(falling(0), 1 / 60);
    expect(centre.ball.vy).toBeLessThan(0);
    expect(Math.abs(centre.ball.vx)).toBeLessThan(8);
    // Never exactly vertical: that locks the ball into one column for good.
    expect(Math.abs(centre.ball.vx)).toBeGreaterThan(0);

    const edge = stepBreakout(falling(BREAKOUT_CONFIG.paddleWidth / 2 - 1), 1 / 60);
    expect(edge.ball.vy).toBeLessThan(0);
    expect(edge.ball.vx, "hitting the right of the paddle sends the ball right").toBeGreaterThan(10);
  });
});

describe("breakout engine — collisions", () => {
  it("bounces off both side walls and the ceiling", () => {
    const base = running();
    const left = stepBreakout({ ...base, ball: { x: 1, y: 70, vx: -60, vy: -10 } }, 1 / 60);
    expect(left.ball.vx).toBeGreaterThan(0);

    const right = stepBreakout({ ...base, ball: { x: BREAKOUT_CONFIG.fieldWidth - 1, y: 70, vx: 60, vy: -10 } }, 1 / 60);
    expect(right.ball.vx).toBeLessThan(0);

    const ceiling = stepBreakout({ ...base, ball: { x: 100, y: 1, vx: 10, vy: -60 } }, 1 / 60);
    expect(ceiling.ball.vy).toBeGreaterThan(0);
  });

  it("never lets the ball leave the field, however long the frame was", () => {
    // A 250 ms frame — a backgrounded tab — used to tunnel the ball straight out.
    let state = running();
    for (let i = 0; i < 200 && state.status === "running"; i += 1) {
      state = stepBreakout(state, 0.25);
      const { x, y } = state.ball;
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(BREAKOUT_CONFIG.fieldWidth);
      expect(y).toBeGreaterThanOrEqual(0);
    }
  });

  it("takes a hit point off a brick and only clears it at zero", () => {
    const base = running();
    const brick = base.bricks.find((item) => item.hp === 3)!;
    const aimed: BreakoutState = {
      ...base,
      ball: { x: brick.x + brick.width / 2, y: brick.y + brick.height + BREAKOUT_CONFIG.ballRadius, vx: 0, vy: -60 },
    };

    const first = stepBreakout(aimed, 1 / 60);
    expect(first.bricks.find((item) => item.id === brick.id)!.hp).toBe(2);
    expect(bricksRemaining(first)).toBe(bricksRemaining(base));
    expect(first.events).toContain("brick");
    expect(first.score).toBe(0);
  });

  it("scores and clears a brick on its last hit point", () => {
    const base = running();
    const brick = base.bricks.find((item) => item.hp === 1)!;
    const aimed: BreakoutState = {
      ...base,
      ball: { x: brick.x + brick.width / 2, y: brick.y + brick.height + BREAKOUT_CONFIG.ballRadius, vx: 0, vy: -60 },
    };

    const hit = stepBreakout(aimed, 1 / 60);
    expect(hit.bricks.find((item) => item.id === brick.id)!.hp).toBe(0);
    expect(hit.events).toContain("break");
    expect(hit.score).toBeGreaterThan(0);
    expect(hit.ball.vy).toBeGreaterThan(0);
  });

  it("pays a rising multiplier for bricks broken without touching the paddle", () => {
    const base = running();
    const brick = base.bricks.find((item) => item.hp === 1)!;
    const shot = (combo: number) =>
      stepBreakout(
        { ...base, combo, ball: { x: brick.x + brick.width / 2, y: brick.y + brick.height + BREAKOUT_CONFIG.ballRadius, vx: 0, vy: -60 } },
        1 / 60,
      ).score;
    expect(shot(3)).toBeGreaterThan(shot(0));
  });

  it("resets the combo when the ball comes back to the paddle", () => {
    const base = running();
    const top = paddleY(BREAKOUT_CONFIG);
    const returning: BreakoutState = {
      ...base,
      combo: 4,
      paddleX: 100,
      ball: { x: 100, y: top - BREAKOUT_CONFIG.ballRadius - 0.2, vx: 0, vy: 50 },
    };
    expect(stepBreakout(returning, 1 / 60).combo).toBe(0);
  });
});

describe("breakout engine — lives and levels", () => {
  it("takes a life and re-seats the ball when it drops past the paddle", () => {
    const base = running();
    const dropped: BreakoutState = { ...base, ball: { x: 100, y: BREAKOUT_CONFIG.fieldHeight + 5, vx: 0, vy: 60 } };
    const after = stepBreakout(dropped, 1 / 60);

    expect(after.lives).toBe(BREAKOUT_CONFIG.lives - 1);
    expect(after.attached).toBe(true);
    expect(after.status).toBe("running");
    expect(after.events).toContain("life");
  });

  it("ends the game when the last life goes", () => {
    const base = running();
    const dropped: BreakoutState = { ...base, lives: 1, ball: { x: 100, y: BREAKOUT_CONFIG.fieldHeight + 5, vx: 0, vy: 60 } };
    expect(stepBreakout(dropped, 1 / 60).status).toBe("over");
  });

  it("moves to the next level, with a bigger wall, when the last brick goes", () => {
    const base = running();
    const brick = base.bricks.find((item) => item.hp === 1)!;
    const lastOne: BreakoutState = {
      ...base,
      bricks: base.bricks.map((item) => (item.id === brick.id ? item : { ...item, hp: 0 })),
      ball: { x: brick.x + brick.width / 2, y: brick.y + brick.height + BREAKOUT_CONFIG.ballRadius, vx: 0, vy: -60 },
    };

    const after = stepBreakout(lastOne, 1 / 60);
    expect(after.level).toBe(2);
    expect(after.attached).toBe(true);
    expect(bricksRemaining(after)).toBe(BREAKOUT_CONFIG.columns * rowsForLevel(BREAKOUT_CONFIG, 2));
    expect(after.events).toContain("level");
  });

  it("wins the run after the last level is cleared", () => {
    const base = running();
    const brick = base.bricks.find((item) => item.hp === 1)!;
    const finale: BreakoutState = {
      ...base,
      level: BREAKOUT_CONFIG.levels,
      bricks: base.bricks.map((item) => (item.id === brick.id ? item : { ...item, hp: 0 })),
      ball: { x: brick.x + brick.width / 2, y: brick.y + brick.height + BREAKOUT_CONFIG.ballRadius, vx: 0, vy: -60 },
    };
    expect(stepBreakout(finale, 1 / 60).status).toBe("won");
  });

  it("freezes once the game is over", () => {
    const over: BreakoutState = { ...running(), status: "over" };
    expect(stepBreakout(over, 1 / 60, 1)).toBe(over);
  });
});

describe("breakout engine — non-visual guidance", () => {
  it("says which way to move and how long there is to do it", () => {
    const base = running();
    const state: BreakoutState = { ...base, paddleX: 60, ball: { x: 140, y: 40, vx: 20, vy: 40 } };
    const bearing = describeBreakoutBoard(state);
    expect(bearing).toContain("to the right");
    expect(bearing).toContain("Move right");
    expect(bearing).toMatch(/arriving in \d/);
  });

  it("tells the player the ball is waiting to be launched", () => {
    expect(describeBreakoutBoard(ready())).toContain("Press Space to launch");
  });

  it("reports the end of the run rather than a stale board", () => {
    expect(describeBreakoutBoard({ ...running(), status: "over", score: 900 })).toContain("Game over with 900 points");
    expect(describeBreakoutBoard({ ...running(), status: "won", score: 4200 })).toContain("Run won with 4200 points");
  });

  it("can be cleared: a competent paddle finishes level one", () => {
    // Returns the ball towards whatever brick is still standing, which is what
    // aiming with the paddle is for. A paddle that only tracks the ball returns
    // it at the same angle every time and orbits one empty corner for ever.
    let state = running();
    for (let frame = 0; frame < 20000 && state.level === 1 && state.status === "running"; frame += 1) {
      const standing = state.bricks.filter((brick) => brick.hp > 0);
      const target = standing.length
        ? standing.reduce((sum, brick) => sum + brick.x + brick.width / 2, 0) / standing.length
        : state.ball.x;
      const wanted = Math.max(-0.9, Math.min(0.9, (target - state.ball.x) / 30));
      state = movePaddle(state, state.ball.x - (BREAKOUT_CONFIG.paddleWidth / 2) * wanted);
      state = stepBreakout(state, 1 / 60);
      if (state.attached && state.status === "running") state = launchBall(state);
    }
    expect(state.level, "aiming at the remaining bricks should clear level one").toBeGreaterThan(1);
    expect(state.score).toBeGreaterThan(0);
  });
});
