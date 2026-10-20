import { describe, expect, it } from "vitest";
import { balanceOf, balancesFromRows, balancesFromTotals } from "@/lib/adminBalances";

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

describe("balanceOf", () => {
  const map = { me: 40, other: 7 };
  it("the admin function covers every user, and a user absent from it has 0", () => {
    expect(balanceOf({ kind: "full", map }, "other")).toBe(7);
    expect(balanceOf({ kind: "full", map }, "nobody")).toBe(0);
  });
  it("the fallback knows only the viewer's own balance, never 0 for anyone else", () => {
    const src = { kind: "own" as const, map, viewerId: "me", viewerRead: true };
    expect(balanceOf(src, "me")).toBe(40);
    expect(balanceOf(src, "other")).toBeUndefined();
    expect(balanceOf(src, "nobody")).toBeUndefined();
  });
  it("a fallback read that did not finish is not a verified balance, not even the viewer's", () => {
    expect(balanceOf({ kind: "own", map, viewerId: "me", viewerRead: false }, "me")).toBeUndefined();
  });
  it("an unknown viewer gets no balance from the fallback", () => {
    expect(balanceOf({ kind: "own", map, viewerId: undefined, viewerRead: true }, "me")).toBeUndefined();
  });
});
