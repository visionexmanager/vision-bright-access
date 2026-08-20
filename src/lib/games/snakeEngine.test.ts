import { describe, expect, it } from "vitest";
import {
  SNAKE_CONFIG,
  biteValue,
  createSnakeState,
  dangerAhead,
  describeSnakeBoard,
  foodBearing,
  queueTurn,
  startSnake,
  stepDurationMs,
  stepSnake,
  type Direction,
  type SnakeState,
} from "./snakeEngine";

const run = (state: SnakeState, turns: (Direction | null)[]) =>
  turns.reduce((current, turn) => stepSnake(turn ? queueTurn(current, turn) : current), state);

const ready = () => startSnake(createSnakeState(7));

describe("snake engine — movement", () => {
  it("does not move until the round starts", () => {
    const idle = createSnakeState(1);
    expect(stepSnake(idle)).toBe(idle);
    expect(startSnake(idle).status).toBe("running");
  });

  it("advances the head and drags the tail by one cell", () => {
    const state = stepSnake(ready());
    expect(state.snake[0]).toEqual({ x: 7, y: 6 });
    expect(state.snake).toHaveLength(3);
  });

  it("refuses a reversal instead of killing the player", () => {
    // Travelling right; pressing left must be ignored, not fatal.
    const state = stepSnake(queueTurn(ready(), "left"));
    expect(state.status).toBe("running");
    expect(state.direction).toBe("right");
  });

  it("refuses a reversal of a turn that is still queued", () => {
    // Up then down inside one tick used to reverse into the neck.
    const queued = queueTurn(queueTurn(ready(), "up"), "down");
    expect(queued.queued).toEqual(["up"]);
  });

  it("applies two queued turns on consecutive ticks so fast corners work", () => {
    const state = run(ready(), ["up", "left"]);
    expect(state.snake[0]).toEqual({ x: 5, y: 5 });
    expect(state.status).toBe("running");
  });

  it("never queues more than two turns", () => {
    const state = queueTurn(queueTurn(queueTurn(ready(), "up"), "left"), "down");
    expect(state.queued).toHaveLength(2);
  });

  it("ends the round at a wall and says so", () => {
    let state = ready();
    for (let i = 0; i < SNAKE_CONFIG.size; i += 1) state = stepSnake(state);
    expect(state.status).toBe("over");
    expect(state.cause).toBe("wall");
  });

  it("ends the round on the snake itself", () => {
    // Travelling up out of a coil, turning left runs the head into the body.
    const coiled: SnakeState = {
      ...ready(),
      snake: [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 4, y: 6 }, { x: 4, y: 5 }, { x: 3, y: 5 }],
      direction: "up",
      food: { x: 0, y: 0 },
    };
    const crashed = stepSnake(queueTurn(coiled, "left"));
    expect(crashed.status).toBe("over");
    expect(crashed.cause).toBe("self");
  });

  it("ends the round on a wall placed by a later level", () => {
    const walled: SnakeState = {
      ...ready(),
      snake: [{ x: 5, y: 5 }, { x: 4, y: 5 }],
      direction: "right",
      obstacles: [{ x: 6, y: 5 }],
      food: { x: 0, y: 0 },
    };
    expect(stepSnake(walled).cause).toBe("obstacle");
  });

  it("lets the head enter the cell the tail leaves on the same tick", () => {
    const chasing: SnakeState = {
      ...ready(),
      snake: [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 4, y: 6 }, { x: 5, y: 6 }],
      direction: "right",
      food: { x: 0, y: 0 },
    };
    // Turning down puts the head exactly where the tail is about to vacate.
    expect(stepSnake(queueTurn(chasing, "down")).status).toBe("running");
  });
});

describe("snake engine — food, score and progression", () => {
  it("holds its invariants across many seeded rounds driven by a safe-turn bot", () => {
    // A greedy bot with one step of lookahead: enough play to exercise food
    // placement, growth, levels and walls together across many boards.
    const chase = (state: SnakeState): Direction | null => {
      const bearing = foodBearing(state);
      const wanted: Direction[] = [];
      if (bearing.horizontal !== "aligned") wanted.push(bearing.horizontal);
      if (bearing.vertical !== "aligned") wanted.push(bearing.vertical);
      for (const direction of [...wanted, "up", "right", "down", "left"] as Direction[]) {
        const turned = queueTurn(state, direction);
        if (turned !== state && !dangerAhead(turned)) return direction;
      }
      return null;
    };

    let totalFood = 0;
    let sawAWall = false;

    for (let seed = 1; seed <= 40; seed += 1) {
      let state = startSnake(createSnakeState(seed));
      for (let tick = 0; state.status === "running" && tick < 1500; tick += 1) {
        const occupied = [...state.snake, ...state.obstacles];
        expect(occupied.some((cell) => cell.x === state.food.x && cell.y === state.food.y)).toBe(false);
        expect(new Set(state.snake.map((cell) => `${cell.x},${cell.y}`)).size).toBe(state.snake.length);
        expect(state.snake).toHaveLength(state.foodEaten + 3);
        const turn = chase(state);
        state = stepSnake(turn ? queueTurn(state, turn) : state);
      }
      totalFood += state.foodEaten;
      sawAWall ||= state.obstacles.length > 0;
    }

    expect(totalFood, "the bot should be able to eat across forty boards").toBeGreaterThan(40);
    expect(sawAWall, "at least one round should reach the obstacle level").toBe(true);
  });

  it("grows the snake by exactly one cell per bite", () => {
    const state = ready();
    const eating: SnakeState = { ...state, food: { x: state.snake[0].x + 1, y: state.snake[0].y } };
    const after = stepSnake(eating);
    expect(after.snake).toHaveLength(state.snake.length + 1);
    expect(after.foodEaten).toBe(1);
  });

  it("pays more for a quick bite than a slow one", () => {
    const fresh = ready();
    const slow: SnakeState = { ...fresh, ticksSinceFood: 30 };
    expect(biteValue(fresh)).toBeGreaterThan(biteValue(slow));
    expect(biteValue(slow)).toBe(10);
  });

  it("pays more per bite at a higher level", () => {
    const base = ready();
    expect(biteValue({ ...base, level: 4 })).toBeGreaterThan(biteValue(base));
  });

  it("raises the level every five bites and speeds the board up", () => {
    const state: SnakeState = { ...ready(), foodEaten: 4, level: 1, food: { x: 7, y: 6 } };
    const after = stepSnake(state);
    expect(after.level).toBe(2);
    expect(stepDurationMs(after)).toBeLessThan(stepDurationMs(state));
  });

  it("never drops the tick below the configured floor", () => {
    expect(stepDurationMs({ ...ready(), level: 99 })).toBe(SNAKE_CONFIG.minStepMs);
  });

  it("adds a wall when a level lands at or past the obstacle level", () => {
    const state: SnakeState = { ...ready(), foodEaten: 9, level: 2, food: { x: 7, y: 6 } };
    const after = stepSnake(state);
    expect(after.level).toBe(3);
    expect(after.obstacles).toHaveLength(1);
  });

  it("never walls the cells straight ahead of the head", () => {
    const state: SnakeState = { ...ready(), foodEaten: 9, level: 2, food: { x: 7, y: 6 } };
    const after = stepSnake(state);
    const [head] = after.snake;
    for (const distance of [1, 2, 3]) {
      expect(after.obstacles).not.toContainEqual({ x: head.x + distance, y: head.y });
    }
  });

  it("wins the round once the target is eaten", () => {
    const state: SnakeState = { ...ready(), foodEaten: SNAKE_CONFIG.target - 1, food: { x: 7, y: 6 } };
    expect(stepSnake(state).status).toBe("won");
  });

  it("replays identically from the same seed and differently from another", () => {
    const play = (seed: number) => {
      let state = startSnake(createSnakeState(seed));
      for (let i = 0; i < 6; i += 1) state = stepSnake(state);
      return `${state.food.x},${state.food.y}`;
    };
    expect(play(42)).toBe(play(42));
    expect(play(42)).not.toBe(play(4242));
  });
});

describe("snake engine — non-visual guidance", () => {
  it("reports the bearing to the food", () => {
    const state: SnakeState = { ...ready(), snake: [{ x: 5, y: 5 }, { x: 4, y: 5 }], food: { x: 2, y: 8 } };
    expect(foodBearing(state)).toEqual({ horizontal: "left", vertical: "down", distance: 6 });
  });

  it("warns before a wall, a body cell and an obstacle", () => {
    const atWall: SnakeState = { ...ready(), snake: [{ x: 11, y: 5 }, { x: 10, y: 5 }], direction: "right" };
    expect(dangerAhead(atWall)).toBe(true);

    const atObstacle: SnakeState = { ...ready(), snake: [{ x: 5, y: 5 }, { x: 4, y: 5 }], direction: "right", obstacles: [{ x: 6, y: 5 }] };
    expect(dangerAhead(atObstacle)).toBe(true);

    const clear: SnakeState = { ...ready(), snake: [{ x: 5, y: 5 }, { x: 4, y: 5 }], direction: "right", obstacles: [] };
    expect(dangerAhead(clear)).toBe(false);
  });

  it("looks at the queued turn, not the old direction, when warning", () => {
    const state: SnakeState = { ...ready(), snake: [{ x: 5, y: 0 }, { x: 4, y: 0 }], direction: "right", obstacles: [] };
    expect(dangerAhead(state)).toBe(false);
    expect(dangerAhead(queueTurn(state, "up"))).toBe(true);
  });

  it("describes the board in words a screen reader can read out", () => {
    const state: SnakeState = { ...ready(), snake: [{ x: 5, y: 5 }, { x: 4, y: 5 }], food: { x: 8, y: 5 }, level: 2, score: 120 };
    const spoken = describeSnakeBoard(state);
    expect(spoken).toContain("column 6, row 6");
    expect(spoken).toContain("Heading right");
    expect(spoken).toContain("3 cells away, right");
    expect(spoken).toContain("Level 2, score 120");
  });

  it("says the round has ended, and why, instead of describing a dead board", () => {
    const base = ready();
    const crashed: SnakeState = { ...base, status: "over", cause: "self", score: 240, level: 3 };
    expect(describeSnakeBoard(crashed)).toBe("Round over: you ran into yourself. 240 points at level 3.");

    const walled: SnakeState = { ...base, status: "over", cause: "wall", score: 10, level: 1 };
    expect(describeSnakeBoard(walled)).toContain("you hit the edge of the board");

    const won: SnakeState = { ...base, status: "won", score: 900, level: 7 };
    expect(describeSnakeBoard(won)).toContain("Round won with 900 points at level 7");
  });
});
