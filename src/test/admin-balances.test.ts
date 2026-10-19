import { describe, expect, it } from "vitest";
import { balancesFromRows, balancesFromTotals } from "@/lib/adminBalances";

describe("balancesFromTotals", () => {
  it("accepts the function's object and keeps each balance with its own user", () => {
    expect(balancesFromTotals({ a: 10, b: -5, c: 0 })).toEqual({ a: 10, b: -5, c: 0 });
  });
  it("accepts the empty object (no user has any rows)", () => {
    expect(balancesFromTotals({})).toEqual({});
  });
  it.each([null, undefined, "x", 3, true, [], [1, 2]])("rejects %j so the caller falls back, not to zero", (bad) => {
    expect(balancesFromTotals(bad)).toBeNull();
  });
  it("rejects a result with a non-numeric or non-finite balance rather than showing it", () => {
    expect(balancesFromTotals({ a: 10, b: "20" })).toBeNull();
    expect(balancesFromTotals({ a: Number.NaN })).toBeNull();
    expect(balancesFromTotals({ a: Infinity })).toBeNull();
    expect(balancesFromTotals({ a: null })).toBeNull();
  });
});

describe("balancesFromRows (fallback)", () => {
  it("sums signed rows per user and treats a missing amount as zero", () => {
    expect(balancesFromRows([
      { user_id: "a", points: 10 }, { user_id: "b", points: 30 }, { user_id: "b", points: -5 }, { user_id: "a", points: null },
    ])).toEqual({ a: 10, b: 25 });
  });
});
