import { describe, expect, it } from "vitest";
import {
  Action,
  CRUISE_ALTITUDE,
  State,
  applyAction,
  createGame,
  crossedMilestone,
  isMoving,
  missingForTakeoff,
  score,
  stars,
} from "./skyMasterEngine";

const run = (state: State, ...actions: Action[]) =>
  actions.reduce((current, action) => applyAction(current, action).state, state);

const ready = () => run(createGame(), { kind: "power" }, { kind: "engine" }, { kind: "flaps" });

/** Ticks until the phase changes, so tests do not hard-code step sizes. */
const untilPhaseChanges = (state: State) => {
  let current = state;
  for (let i = 0; i < 200 && current.phase === state.phase; i++) current = applyAction(current, { kind: "tick" }).state;
  return current;
};

/** A clean flight retracts the flaps once airborne, so nothing drags at cruise. */
const cruising = () => untilPhaseChanges(run(ready(), { kind: "rotate" }, { kind: "flaps" }));
const landed = () =>
  untilPhaseChanges(run(cruising(), { kind: "serve", item: "meal" }, { kind: "serve", item: "drink" }, { kind: "announce" }));

describe("pre-flight checklist", () => {
  it("starts cold with a full tank and no mistakes", () => {
    const game = createGame();
    expect(game).toMatchObject({ phase: "preflight", power: false, engine: false, flaps: false, altitude: 0, fuel: 100, mistakes: 0 });
  });

  it("refuses the engine without power, and says why", () => {
    const result = applyAction(createGame(), { kind: "engine" });
    expect(result.notice).toBe("needPower");
    expect(result.state.engine).toBe(false);
    expect(result.state.mistakes).toBe(1);
  });

  it("starts the engine once power is on", () => {
    const result = applyAction(run(createGame(), { kind: "power" }), { kind: "engine" });
    expect(result.notice).toBe("engineOn");
    expect(result.state.engine).toBe(true);
  });

  it("will not switch power off under a running engine", () => {
    const state = run(createGame(), { kind: "power" }, { kind: "engine" });
    const result = applyAction(state, { kind: "power" });
    expect(result.notice).toBe("powerLocked");
    expect(result.state.power).toBe(true);
  });

  it("names exactly what is missing when take-off is refused", () => {
    const state = run(createGame(), { kind: "power" });
    expect(missingForTakeoff(state)).toEqual(["engine", "flaps"]);
    const result = applyAction(state, { kind: "rotate" });
    expect(result.notice).toBe("notReady");
    expect(result.missing).toEqual(["engine", "flaps"]);
    expect(result.state.phase).toBe("preflight");
  });

  it("takes off when the checklist is complete", () => {
    const result = applyAction(ready(), { kind: "rotate" });
    expect(result.notice).toBe("takeoff");
    expect(result.state.phase).toBe("climb");
    expect(isMoving(result.state)).toBe(true);
  });
});

describe("climb and cruise", () => {
  it("climbs in steps and stops at cruise altitude", () => {
    const first = applyAction(run(ready(), { kind: "rotate" }), { kind: "tick" });
    expect(first.state.altitude).toBeGreaterThan(0);
    expect(first.state.phase).toBe("climb");
    const top = cruising();
    expect(top.phase).toBe("cruise");
    expect(top.altitude).toBe(CRUISE_ALTITUDE);
    expect(isMoving(top)).toBe(false);
  });

  it("costs fuel and a mistake when the flaps are left out at cruise", () => {
    const clean = run(createGame(), { kind: "power" }, { kind: "engine" }, { kind: "flaps" }, { kind: "rotate" }, { kind: "flaps" });
    const clear = untilPhaseChanges(clean);
    expect(clear.mistakes).toBe(0);

    let current = run(ready(), { kind: "rotate" });
    let notice: string | null = null;
    for (let i = 0; i < 200 && current.phase === "climb"; i++) {
      const next = applyAction(current, { kind: "tick" });
      current = next.state;
      notice = next.notice;
    }
    expect(notice).toBe("cruiseFlapsDrag");
    expect(current.mistakes).toBe(1);
    expect(current.flaps).toBe(false);
    expect(current.fuel).toBeLessThan(clear.fuel);
  });
});

describe("cabin service", () => {
  it("is refused before cruise altitude", () => {
    const result = applyAction(run(ready(), { kind: "rotate" }), { kind: "serve", item: "meal" });
    expect(result.notice).toBe("waitCruise");
    expect(result.state.served.meal).toBe(false);
  });

  it("serves each item once", () => {
    const once = applyAction(cruising(), { kind: "serve", item: "meal" });
    expect(once.notice).toBe("served");
    const twice = applyAction(once.state, { kind: "serve", item: "meal" });
    expect(twice.notice).toBe("alreadyServed");
    expect(twice.state.fuel).toBe(once.state.fuel);
  });

  it("needs both services before the descent announcement", () => {
    const early = applyAction(run(cruising(), { kind: "serve", item: "meal" }), { kind: "announce" });
    expect(early.notice).toBe("serveFirst");
    expect(early.state.phase).toBe("cruise");
    const both = run(cruising(), { kind: "serve", item: "meal" }, { kind: "serve", item: "drink" });
    expect(applyAction(both, { kind: "announce" }).state.phase).toBe("descent");
  });
});

describe("descent and scoring", () => {
  it("lands at zero altitude with the engine off", () => {
    const end = landed();
    expect(end.phase).toBe("landed");
    expect(end.altitude).toBe(0);
    expect(end.engine).toBe(false);
    expect(isMoving(end)).toBe(false);
  });

  it("never lets fuel go negative", () => {
    let state = createGame();
    for (let i = 0; i < 300; i++) state = applyAction(state, { kind: "engine" }).state;
    expect(state.fuel).toBeGreaterThanOrEqual(0);
  });

  it("gives no stars or score before landing", () => {
    expect(stars(cruising())).toBe(0);
    expect(score(cruising())).toBe(0);
  });

  it("gives three stars for a clean flight and fewer for sloppy ones", () => {
    expect(stars(landed())).toBe(3);
    const sloppy = { ...landed(), mistakes: 6, fuel: 60 };
    expect(stars(sloppy)).toBe(1);
    expect(score(sloppy)).toBeLessThan(score(landed()));
  });

  it("charges nothing for cabin buttons pressed after the flight is over", () => {
    const end = landed();
    for (const action of [{ kind: "serve", item: "meal" }, { kind: "announce" }] as Action[]) {
      const result = applyAction(end, action);
      expect(result.state).toBe(end);
      expect(result.notice).toBeNull();
    }
    expect(stars(end)).toBe(3);
  });

  it("ignores the clock outside climb and descent", () => {
    const state = createGame();
    expect(applyAction(state, { kind: "tick" }).state).toBe(state);
  });
});

describe("altitude announcements", () => {
  it("fires once per 2,500 feet while climbing", () => {
    expect(crossedMilestone(0, 500)).toBeNull();
    expect(crossedMilestone(2000, 2500)).toBe(2500);
    expect(crossedMilestone(2500, 3000)).toBeNull();
  });

  it("fires on the way down too, without repeating the cruise altitude", () => {
    expect(crossedMilestone(10000, 9200)).toBeNull();
    expect(crossedMilestone(7600, 6800)).toBe(7500);
  });
});
