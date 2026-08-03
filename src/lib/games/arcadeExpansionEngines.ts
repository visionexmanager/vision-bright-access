export type Direction = "left" | "right" | "up" | "down";
export type Grid2048 = number[][];

export function empty2048(): Grid2048 { return Array.from({ length: 4 }, () => Array(4).fill(0)); }

export function add2048Tile(grid: Grid2048, random = Math.random): Grid2048 {
  const empty: [number, number][] = [];
  grid.forEach((row, r) => row.forEach((value, c) => { if (!value) empty.push([r, c]); }));
  if (!empty.length) return grid.map((row) => [...row]);
  const [r, c] = empty[Math.floor(random() * empty.length)];
  const next = grid.map((row) => [...row]);
  next[r][c] = random() < .9 ? 2 : 4;
  return next;
}

function collapse(line: number[]) {
  const values = line.filter(Boolean); const result: number[] = []; let score = 0;
  for (let i = 0; i < values.length; i++) {
    if (values[i] === values[i + 1]) { const value = values[i] * 2; result.push(value); score += value; i++; }
    else result.push(values[i]);
  }
  return { line:[...result, ...Array(4 - result.length).fill(0)], score };
}

export function move2048(grid: Grid2048, direction: Direction) {
  let score = 0; const result = empty2048();
  for (let index = 0; index < 4; index++) {
    const source = direction === "left" || direction === "right"
      ? [...grid[index]] : grid.map((row) => row[index]);
    if (direction === "right" || direction === "down") source.reverse();
    const merged = collapse(source); score += merged.score;
    if (direction === "right" || direction === "down") merged.line.reverse();
    merged.line.forEach((value, offset) => {
      if (direction === "left" || direction === "right") result[index][offset] = value;
      else result[offset][index] = value;
    });
  }
  return { grid:result, score, moved:JSON.stringify(result) !== JSON.stringify(grid) };
}

export function canMove2048(grid: Grid2048) {
  if (grid.some((row) => row.includes(0))) return true;
  return grid.some((row, r) => row.some((value, c) => value === row[c + 1] || value === grid[r + 1]?.[c]));
}

export type MineCell = { mine:boolean; revealed:boolean; flagged:boolean; adjacent:number };
export type MineBoard = MineCell[][];

export function createMineBoard(size = 9, mines = 10, random = Math.random): MineBoard {
  const locations = Array.from({ length:size * size }, (_, i) => i);
  for (let i = locations.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [locations[i], locations[j]] = [locations[j], locations[i]]; }
  const mineSet = new Set(locations.slice(0, mines));
  return Array.from({ length:size }, (_, r) => Array.from({ length:size }, (_, c) => {
    const adjacent = [-1,0,1].flatMap(dr => [-1,0,1].map(dc => [r+dr,c+dc])).filter(([rr,cc]) => rr>=0 && cc>=0 && rr<size && cc<size && mineSet.has(rr*size+cc)).length;
    return { mine:mineSet.has(r*size+c), revealed:false, flagged:false, adjacent };
  }));
}

export function revealMineCell(board: MineBoard, row: number, column: number): MineBoard {
  const next = board.map(line => line.map(cell => ({ ...cell }))); const queue:[[number,number]]|[number,number][] = [[row,column]]; const seen = new Set<string>();
  while (queue.length) {
    const [r,c] = queue.shift()!; const cell = next[r]?.[c]; const key=`${r}:${c}`;
    if (!cell || cell.flagged || cell.revealed || seen.has(key)) continue;
    seen.add(key); cell.revealed = true;
    if (!cell.mine && cell.adjacent === 0) for (let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++) if(dr||dc) queue.push([r+dr,c+dc]);
  }
  return next;
}

export type ConnectCell = 0 | 1 | 2;
export type ConnectBoard = ConnectCell[][];
export function emptyConnectFour(): ConnectBoard { return Array.from({length:6},()=>Array(7).fill(0)); }
export function dropConnectFour(board:ConnectBoard, column:number, player:1|2) {
  const next=board.map(row=>[...row]);
  for(let row=5;row>=0;row--) if(next[row][column]===0){ next[row][column]=player; return {board:next,row}; }
  return {board,row:-1};
}
export function winnerConnectFour(board:ConnectBoard):ConnectCell {
  const directions=[[0,1],[1,0],[1,1],[1,-1]];
  for(let r=0;r<6;r++) for(let c=0;c<7;c++) if(board[r][c]) for(const [dr,dc] of directions) if([0,1,2,3].every(i=>board[r+i*dr]?.[c+i*dc]===board[r][c])) return board[r][c];
  return 0;
}
