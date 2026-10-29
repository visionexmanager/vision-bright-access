/**
 * Sky Master: a pre-flight checklist, a climb, cabin service at cruise, a descent.
 *
 * Pure and deterministic so the page only renders and the rules can be tested. Nothing here
 * fails the player: a wrong order costs fuel and a mistake mark, and the flight still lands.
 * Time only moves the aircraft through climb and descent; every decision is a button press.
 */

export const CRUISE_ALTITUDE = 10000;
export const CLIMB_STEP = 500;
export const DESCENT_STEP = 800;

const CLIMB_FUEL = 0.5;
const DESCENT_FUEL = 0.2;
const SERVICE_FUEL = 1;
const FLAPS_DRAG_FUEL = 3;
const MISTAKE_FUEL = 1;

export type Phase = "preflight" | "climb" | "cruise" | "descent" | "landed";
export type CabinItem = "meal" | "drink";

export interface State {
  phase: Phase;
  power: boolean;
  engine: boolean;
  flaps: boolean;
  altitude: number;
  fuel: number;
  served: Record<CabinItem, boolean>;
  mistakes: number;
}

export type Action =
  | { kind: "power" }
  | { kind: "engine" }
  | { kind: "flaps" }
  | { kind: "rotate" }
  | { kind: "serve"; item: CabinItem }
  | { kind: "announce" }
  | { kind: "tick" };

/** What happened, so the page can say it in the player's language. */
export type Notice =
  | "powerOn"
  | "powerOff"
  | "powerLocked"
  | "needPower"
  | "engineOn"
  | "engineRunning"
  | "flapsOut"
  | "flapsIn"
  | "notReady"
  | "takeoff"
  | "cruise"
  | "cruiseFlapsDrag"
  | "waitCruise"
  | "served"
  | "alreadyServed"
  | "serveFirst"
  | "descent"
  | "landed"
  | null;

/** Which checklist items still block take-off. */
export type Missing = "power" | "engine" | "flaps";

export interface Result {
  state: State;
  notice: Notice;
  missing: Missing[];
}

export function createGame(): State {
  return {
    phase: "preflight",
    power: false,
    engine: false,
    flaps: false,
    altitude: 0,
    fuel: 100,
    served: { meal: false, drink: false },
    mistakes: 0,
  };
}

export function missingForTakeoff(state: State): Missing[] {
  const missing: Missing[] = [];
  if (!state.power) missing.push("power");
  if (!state.engine) missing.push("engine");
  if (!state.flaps) missing.push("flaps");
  return missing;
}

const burn = (fuel: number, amount: number) => Math.max(0, Math.round((fuel - amount) * 10) / 10);

const done = (state: State, notice: Notice, missing: Missing[] = []): Result => ({ state, notice, missing });

/** A refused action leaves the aircraft alone and costs a little fuel and a mistake mark. */
const refuse = (state: State, notice: Notice, missing: Missing[] = []): Result =>
  done({ ...state, mistakes: state.mistakes + 1, fuel: burn(state.fuel, MISTAKE_FUEL) }, notice, missing);

export function applyAction(state: State, action: Action): Result {
  switch (action.kind) {
    case "power": {
      if (state.phase !== "preflight" || state.engine) return refuse(state, "powerLocked");
      const power = !state.power;
      return done({ ...state, power }, power ? "powerOn" : "powerOff");
    }

    case "engine": {
      if (state.phase !== "preflight") return done(state, null);
      if (state.engine) return done(state, "engineRunning");
      if (!state.power) return refuse(state, "needPower");
      return done({ ...state, engine: true }, "engineOn");
    }

    case "flaps": {
      if (state.phase === "landed" || state.phase === "descent") return done(state, null);
      const flaps = !state.flaps;
      return done({ ...state, flaps }, flaps ? "flapsOut" : "flapsIn");
    }

    case "rotate": {
      if (state.phase !== "preflight") return done(state, null);
      const missing = missingForTakeoff(state);
      if (missing.length > 0) return refuse(state, "notReady", missing);
      return done({ ...state, phase: "climb" }, "takeoff");
    }

    case "serve": {
      if (state.phase === "descent" || state.phase === "landed") return done(state, null);
      if (state.phase !== "cruise") return refuse(state, "waitCruise");
      if (state.served[action.item]) return done(state, "alreadyServed");
      return done(
        { ...state, served: { ...state.served, [action.item]: true }, fuel: burn(state.fuel, SERVICE_FUEL) },
        "served",
      );
    }

    case "announce": {
      if (state.phase === "descent" || state.phase === "landed") return done(state, null);
      if (state.phase !== "cruise") return refuse(state, "waitCruise");
      if (!state.served.meal || !state.served.drink) return refuse(state, "serveFirst");
      return done({ ...state, phase: "descent" }, "descent");
    }

    case "tick": {
      if (state.phase === "climb") {
        const altitude = Math.min(CRUISE_ALTITUDE, state.altitude + CLIMB_STEP);
        const fuel = burn(state.fuel, CLIMB_FUEL);
        if (altitude < CRUISE_ALTITUDE) return done({ ...state, altitude, fuel }, null);
        // Flaps left out at cruise altitude drag, so they are retracted for the player at a cost.
        const dragged = state.flaps;
        return done(
          {
            ...state,
            phase: "cruise",
            altitude,
            flaps: false,
            fuel: dragged ? burn(fuel, FLAPS_DRAG_FUEL) : fuel,
            mistakes: dragged ? state.mistakes + 1 : state.mistakes,
          },
          dragged ? "cruiseFlapsDrag" : "cruise",
        );
      }
      if (state.phase === "descent") {
        const altitude = Math.max(0, state.altitude - DESCENT_STEP);
        const fuel = burn(state.fuel, DESCENT_FUEL);
        if (altitude > 0) return done({ ...state, altitude, fuel }, null);
        return done({ ...state, phase: "landed", altitude: 0, fuel, engine: false }, "landed");
      }
      return done(state, null);
    }
  }
}

/** Fuel left and mistakes decide the stars; landing at all is always worth one. */
export function stars(state: State): 0 | 1 | 2 | 3 {
  if (state.phase !== "landed") return 0;
  if (state.fuel >= 85 && state.mistakes === 0) return 3;
  if (state.fuel >= 75 && state.mistakes <= 2) return 2;
  return 1;
}

export function score(state: State): number {
  if (state.phase !== "landed") return 0;
  return Math.max(0, Math.round(state.fuel * 10) - state.mistakes * 25);
}

/** True while the clock should be advancing the aircraft. */
export const isMoving = (state: State) => state.phase === "climb" || state.phase === "descent";

/** Altitude milestones worth announcing aloud; every tick would drown a screen reader. */
export function crossedMilestone(before: number, after: number, every = 2500): number | null {
  const a = Math.floor(before / every);
  const b = Math.floor(after / every);
  if (a === b) return null;
  if (before < after) return b * every;
  // Descending: the line crossed is the one just above the new reading.
  const line = (b + 1) * every;
  return before > line ? line : null;
}
