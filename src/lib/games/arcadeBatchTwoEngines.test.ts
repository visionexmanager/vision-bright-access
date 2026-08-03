import {describe,expect,it} from "vitest";
import {chooseTicMove,createMathQuestion,moveMaze,ticWinner} from "./arcadeBatchTwoEngines";
describe("Arcade batch two engines",()=>{
  it("detects wins and selects a winning tactical move",()=>{expect(ticWinner(["X","X","X",null,null,null,null,null,null])).toBe("X");expect(chooseTicMove(["O","O",null,"X",null,null,"X",null,null])).toBe(2)});
  it("creates deterministic level math",()=>{expect(createMathQuestion(1,()=>0)).toEqual({left:1,right:1,operation:"+",answer:2});expect(createMathQuestion(9,()=>0).operation).toBe("×")});
  it("moves only through open maze cells",()=>{expect(moveMaze({row:0,column:0},"right")).toEqual({row:0,column:1});expect(moveMaze({row:0,column:0},"down")).toEqual({row:0,column:0})});
});
