export type Player = "w" | "b";

/** Sentinels used in place of a board index. */
export const BAR = -1;
export const OFF = 99;

export interface State {
  /** 24 points; a positive count is white, a negative count is black. */
  points: number[];
  bar: Record<Player, number>;
  off: Record<Player, number>;
  turn: Player;
  /** Dice still available this turn. */
  dice: number[];
  rolled: [number, number] | null;
}

export interface Move { from: number; to: number; die: number; hit: boolean; }

/** White travels 23 → 0 and bears off past 0; black travels 0 → 23. */
export function createGame(turn: Player = "w"): State {
  const points = new Array(24).fill(0);
  points[23] = 2; points[12] = 5; points[7] = 3; points[5] = 5;
  points[0] = -2; points[11] = -5; points[16] = -3; points[18] = -5;
  return { points, bar: { w: 0, b: 0 }, off: { w: 0, b: 0 }, turn, dice: [], rolled: null };
}

export function rollPair(): [number, number] {
  return [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
}

export function diceFromRoll([a, b]: [number, number]): number[] {
  return a === b ? [a, a, a, a] : [a, b];
}

function countAt(state: State, player: Player, index: number): number {
  const value = state.points[index];
  return player === "w" ? Math.max(0, value) : Math.max(0, -value);
}

function opponentAt(state: State, player: Player, index: number): number {
  return countAt(state, player === "w" ? "b" : "w", index);
}

/** A point is open unless the opponent holds two or more checkers on it. */
function canLand(state: State, player: Player, index: number): boolean {
  return opponentAt(state, player, index) <= 1;
}

export function homeComplete(state: State, player: Player): boolean {
  if (state.bar[player] > 0) return false;
  const outside = player === "w"
    ? state.points.slice(6).some((value) => value > 0)
    : state.points.slice(0, 18).some((value) => value < 0);
  return !outside;
}

/** Pips left for `player` to bring every checker home and off. */
export function pipCount(state: State, player: Player): number {
  let pips = state.bar[player] * 25;
  state.points.forEach((value, index) => {
    const count = player === "w" ? Math.max(0, value) : Math.max(0, -value);
    pips += count * (player === "w" ? index + 1 : 24 - index);
  });
  return pips;
}

/** Distance from `index` to bearing off, so white at 0 and black at 23 both need a 1. */
function distanceToOff(player: Player, index: number): number {
  return player === "w" ? index + 1 : 24 - index;
}

function hasCheckerBehind(state: State, player: Player, index: number): boolean {
  if (player === "w") {
    for (let i = index + 1; i <= 5; i += 1) if (state.points[i] > 0) return true;
    return false;
  }
  for (let i = 18; i < index; i += 1) if (state.points[i] < 0) return true;
  return false;
}

export function legalMoves(state: State, player: Player = state.turn): Move[] {
  const moves: Move[] = [];
  const dice = [...new Set(state.dice)];

  for (const die of dice) {
    // Checkers on the bar must re-enter before anything else may move.
    if (state.bar[player] > 0) {
      const entry = player === "w" ? 24 - die : die - 1;
      if (canLand(state, player, entry)) {
        moves.push({ from: BAR, to: entry, die, hit: opponentAt(state, player, entry) === 1 });
      }
      continue;
    }

    for (let index = 0; index < 24; index += 1) {
      if (countAt(state, player, index) === 0) continue;
      const target = player === "w" ? index - die : index + die;

      if (target >= 0 && target <= 23) {
        if (canLand(state, player, target)) {
          moves.push({ from: index, to: target, die, hit: opponentAt(state, player, target) === 1 });
        }
        continue;
      }

      // Off the board — only legal once every checker is home, and either the die
      // matches exactly or nothing sits further from the edge.
      if (!homeComplete(state, player)) continue;
      const needed = distanceToOff(player, index);
      if (die === needed || (die > needed && !hasCheckerBehind(state, player, index))) {
        moves.push({ from: index, to: OFF, die, hit: false });
      }
    }
  }

  return moves;
}

function cloneState(state: State): State {
  return {
    points: [...state.points],
    bar: { ...state.bar },
    off: { ...state.off },
    turn: state.turn,
    dice: [...state.dice],
    rolled: state.rolled,
  };
}

export function applyMove(state: State, move: Move): State {
  const player = state.turn;
  const next = cloneState(state);
  const sign = player === "w" ? 1 : -1;

  if (move.from === BAR) next.bar[player] -= 1;
  else next.points[move.from] -= sign;

  if (move.to === OFF) {
    next.off[player] += 1;
  } else {
    if (move.hit) {
      next.points[move.to] = 0;
      next.bar[player === "w" ? "b" : "w"] += 1;
    }
    next.points[move.to] += sign;
  }

  const dieIndex = next.dice.indexOf(move.die);
  if (dieIndex !== -1) next.dice.splice(dieIndex, 1);
  return next;
}

export function winner(state: State): Player | null {
  if (state.off.w === 15) return "w";
  if (state.off.b === 15) return "b";
  return null;
}

/** Positive scores favour `player`. Rewards borne-off checkers, safe points and hits. */
export function evaluate(state: State, player: Player): number {
  const opponent: Player = player === "w" ? "b" : "w";
  let score = state.off[player] * 60 - state.off[opponent] * 60;
  score += state.bar[opponent] * 30 - state.bar[player] * 40;
  score += (pipCount(state, opponent) - pipCount(state, player)) * 0.7;

  state.points.forEach((value, index) => {
    const own = player === "w" ? Math.max(0, value) : Math.max(0, -value);
    if (own === 1) score -= 12;
    if (own >= 2) score += 8;
    // Holding points inside the opponent's entry zone is worth extra.
    const inHome = player === "w" ? index <= 5 : index >= 18;
    if (own >= 2 && inHome) score += 6;
  });

  return score;
}

const MAX_NODES = 60000;

/** Greedy-with-lookahead: searches every ordering of the remaining dice. */
export function planTurn(state: State, player: Player): Move[] {
  let visited = 0;
  let bestSequence: Move[] = [];
  let bestScore = -Infinity;

  const walk = (current: State, sequence: Move[]) => {
    visited += 1;
    if (visited > MAX_NODES) return;

    const moves = current.dice.length > 0 ? legalMoves(current, player) : [];
    if (moves.length === 0) {
      const score = evaluate(current, player) + sequence.length * 5;
      if (score > bestScore) { bestScore = score; bestSequence = sequence; }
      return;
    }

    for (const move of moves) {
      walk(applyMove(current, move), [...sequence, move]);
      if (visited > MAX_NODES) return;
    }
  };

  walk(state, []);
  return bestSequence;
}
