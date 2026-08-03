import {describe,expect,it} from "vitest";
import {NONOGRAM_SOLUTION,nonogramComplete,scoreMastermind,validSudokuMove,wordExists} from "./arcadeBatchThreeEngines";
describe("Arcade batch three engines",()=>{
 it("validates Sudoku against its maintained solution",()=>{expect(validSudokuMove(0,2,4)).toBe(true);expect(validSudokuMove(0,2,8)).toBe(false)});
 it("validates a completed nonogram",()=>expect(nonogramComplete(NONOGRAM_SOLUTION.map(row=>row.map(Boolean)))).toBe(true));
 it("scores Mastermind without double-counting colors",()=>expect(scoreMastermind([1,1,2,3],[1,2,1,4])).toEqual({exact:1,color:2}));
 it("finds horizontal and vertical maintained words",()=>{expect(wordExists("visionex")).toBe(true);expect(wordExists("not-there")).toBe(false)});
});
