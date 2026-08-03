import { describe, expect, it } from "vitest";
import { add2048Tile, canMove2048, createMineBoard, dropConnectFour, empty2048, emptyConnectFour, move2048, revealMineCell, winnerConnectFour } from "./arcadeExpansionEngines";

describe("Arcade expansion engines", () => {
  it("merges 2048 tiles once per move",()=>{ const grid=empty2048(); grid[0]=[2,2,2,2]; const moved=move2048(grid,"left"); expect(moved.grid[0]).toEqual([4,4,0,0]); expect(moved.score).toBe(8); });
  it("adds a deterministic tile and detects a locked board",()=>{ expect(add2048Tile(empty2048(),()=>0).flat().filter(Boolean)).toEqual([2]); expect(canMove2048([[2,4,2,4],[4,2,4,2],[2,4,2,4],[4,2,4,2]])).toBe(false); });
  it("creates the requested mine count and flood-reveals safe space",()=>{ const board=createMineBoard(5,3,()=>.5); expect(board.flat().filter(c=>c.mine)).toHaveLength(3); const safe=board.flat().findIndex(c=>!c.mine); const next=revealMineCell(board,Math.floor(safe/5),safe%5); expect(next.flat().some(c=>c.revealed)).toBe(true); });
  it("drops pieces and detects four in a row",()=>{ let board=emptyConnectFour(); for(let c=0;c<4;c++) board=dropConnectFour(board,c,1).board; expect(winnerConnectFour(board)).toBe(1); });
});
