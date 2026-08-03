import { describe, expect, it } from "vitest";
import { airHockeyShot, basketballShot, penaltyShot, tableTennisReturn } from "./arcadeArenaSportsEngine";

describe("Arcade arena sports engine", () => {
  it("scores a controlled penalty away from the keeper", () => {
    expect(penaltyShot(82, 76, 45)).toMatchObject({ scored: true });
    expect(penaltyShot(52, 76, 45).scored).toBe(false);
  });

  it("models basketball power by distance", () => {
    expect(basketballShot(63, 50, 5).scored).toBe(true);
    expect(basketballShot(25, 50, 5).scored).toBe(false);
  });

  it("rewards table-tennis placement into open court", () => {
    expect(tableTennisReturn(85, 50, 40).scored).toBe(true);
    expect(tableTennisReturn(48, 50, 40).scored).toBe(false);
  });

  it("scores air-hockey shots that avoid the defense", () => {
    expect(airHockeyShot(80, 82, 35).scored).toBe(true);
    expect(airHockeyShot(42, 82, 35).scored).toBe(false);
  });
});
