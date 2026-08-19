import {describe,expect,it} from "vitest";
import {NONOGRAM_SOLUTION,nonogramComplete,scoreMastermind,wordExists} from "./arcadeBatchThreeEngines";
describe("Arcade batch three engines",()=>{
 it("validates a completed nonogram",()=>expect(nonogramComplete(NONOGRAM_SOLUTION.map(row=>row.map(Boolean)))).toBe(true));
 it("scores Mastermind without double-counting colors",()=>expect(scoreMastermind([1,1,2,3],[1,2,1,4])).toEqual({exact:1,color:2}));
 it("finds horizontal and vertical maintained words",()=>{expect(wordExists("visionex")).toBe(true);expect(wordExists("not-there")).toBe(false)});
});
