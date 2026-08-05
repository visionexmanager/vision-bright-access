export type HexCell = 0 | 1 | 2;
export type HexBoard = HexCell[][];

export function createHexBoard(size = 5): HexBoard {
  return Array.from({ length: size }, () => Array<HexCell>(size).fill(0));
}

export function playHex(board: HexBoard, row: number, column: number, player: 1 | 2) {
  if (board[row]?.[column] !== 0) return board;
  const next = board.map((line) => [...line]);
  next[row][column] = player;
  return next;
}

const HEX_NEIGHBORS = [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0]] as const;

export function hasHexPath(board: HexBoard, player: 1 | 2) {
  const size = board.length;
  const queue: Array<[number, number]> = [];
  const seen = new Set<string>();
  if (player === 1) for (let row = 0; row < size; row++) if (board[row][0] === player) queue.push([row, 0]);
  else for (let column = 0; column < size; column++) if (board[0][column] === player) queue.push([0, column]);
  while (queue.length) {
    const [row, column] = queue.shift()!;
    const key = `${row},${column}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if ((player === 1 && column === size - 1) || (player === 2 && row === size - 1)) return true;
    for (const [dr, dc] of HEX_NEIGHBORS) {
      const r = row + dr, c = column + dc;
      if (board[r]?.[c] === player && !seen.has(`${r},${c}`)) queue.push([r, c]);
    }
  }
  return false;
}

export interface MancalaState { pits: number[]; current: 0 | 1; }
export function createMancala(): MancalaState { return { pits: [4,4,4,4,4,4,0,4,4,4,4,4,4,0], current: 0 }; }
const storeFor = (player: 0 | 1) => player === 0 ? 6 : 13;
const ownsPit = (player: 0 | 1, pit: number) => player === 0 ? pit >= 0 && pit <= 5 : pit >= 7 && pit <= 12;

export function playMancala(state: MancalaState, pit: number): MancalaState {
  if (!ownsPit(state.current, pit) || state.pits[pit] === 0) return state;
  const pits = [...state.pits];
  let stones = pits[pit], cursor = pit;
  pits[pit] = 0;
  while (stones) {
    cursor = (cursor + 1) % 14;
    if (cursor === storeFor(state.current === 0 ? 1 : 0)) continue;
    pits[cursor]++; stones--;
  }
  if (ownsPit(state.current, cursor) && pits[cursor] === 1) {
    const opposite = 12 - cursor;
    if (pits[opposite] > 0) {
      pits[storeFor(state.current)] += pits[opposite] + 1;
      pits[opposite] = 0; pits[cursor] = 0;
    }
  }
  const current = cursor === storeFor(state.current) ? state.current : (state.current === 0 ? 1 : 0);
  const playerEmpty = pits.slice(0, 6).every((value) => value === 0);
  const computerEmpty = pits.slice(7, 13).every((value) => value === 0);
  if (playerEmpty || computerEmpty) {
    pits[6] += pits.slice(0, 6).reduce((sum, value) => sum + value, 0);
    pits[13] += pits.slice(7, 13).reduce((sum, value) => sum + value, 0);
    for (let index = 0; index < 6; index++) pits[index] = 0;
    for (let index = 7; index < 13; index++) pits[index] = 0;
  }
  return { pits, current };
}

export function mancalaFinished(state: MancalaState) {
  return state.pits.slice(0, 6).every((value) => value === 0) || state.pits.slice(7, 13).every((value) => value === 0);
}

export interface RaceState { player: number[]; computer: number[]; turn: "player" | "computer"; }
export const createLudo = (): RaceState => ({ player: [-1,-1,-1,-1], computer: [-1,-1,-1,-1], turn: "player" });
export const createUr = (): RaceState => ({ player: [-1,-1,-1], computer: [-1,-1,-1], turn: "player" });

export function moveRaceToken(state: RaceState, side: "player" | "computer", token: number, roll: number, finish: number, enterOnSix = false): RaceState {
  const pieces = [...state[side]];
  const position = pieces[token];
  if (position === finish || (position < 0 && enterOnSix && roll !== 6)) return state;
  const destination = position < 0 ? 0 : position + roll;
  if (destination > finish) return state;
  pieces[token] = destination;
  const opponentSide = side === "player" ? "computer" : "player";
  const opponent = [...state[opponentSide]];
  const safe = new Set([0, 8, 13, 21, 26, 34, finish]);
  if (!safe.has(destination)) opponent.forEach((value, index) => { if (value === destination) opponent[index] = -1; });
  return { ...state, [side]: pieces, [opponentSide]: opponent, turn: opponentSide };
}

export function availableRaceTokens(state: RaceState, side: "player" | "computer", roll: number, finish: number, enterOnSix = false) {
  return state[side].map((position, index) => ({ position, index })).filter(({ position }) => position !== finish && (position >= 0 ? position + roll <= finish : !enterOnSix || roll === 6)).map(({ index }) => index);
}
