import { describe, expect, it, vi } from "vitest";
import { fetchAllRows } from "@/lib/fetchAllRows";

// A fake table that behaves like PostgREST with max_rows = 1000: it returns at
// most 1000 rows per request however wide the requested range is.
const table = (n: number, cap = 1000) => {
  const all = Array.from({ length: n }, (_, i) => ({ id: i }));
  const requests: Array<[number, number]> = [];
  const page = async (from: number, to: number) => {
    requests.push([from, to]);
    return { data: all.slice(from, Math.min(to + 1, from + cap)), error: null };
  };
  return { page, requests, all };
};

describe("fetchAllRows", () => {
  it("returns every row of a table larger than the API cap, once each", async () => {
    const t = table(2500);
    const rows = await fetchAllRows(t.page);
    expect(rows).toHaveLength(2500);
    expect(new Set(rows.map((r) => r.id)).size).toBe(2500);
    expect(t.requests).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it("a table that fits in one page costs one request", async () => {
    const t = table(20);
    expect(await fetchAllRows(t.page)).toHaveLength(20);
    expect(t.requests).toEqual([[0, 999]]);
  });

  it("an exact multiple of the page size asks once more and stops on the empty page", async () => {
    const t = table(2000);
    expect(await fetchAllRows(t.page)).toHaveLength(2000);
    expect(t.requests).toHaveLength(3);
  });

  it("an empty table returns no rows", async () => {
    expect(await fetchAllRows(table(0).page)).toEqual([]);
  });

  it("a failed page ends the read, returns what it has and logs it", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let n = 0;
    const rows = await fetchAllRows(async (from) => (n++ === 1
      ? { data: null, error: new Error("boom") }
      : { data: Array.from({ length: 1000 }, (_, i) => ({ id: from + i })), error: null }));
    expect(rows).toHaveLength(1000);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("never loops forever on a source that always returns a full page", async () => {
    let calls = 0;
    const rows = await fetchAllRows(async () => { calls++; return { data: [{ id: 1 }], error: null }; }, 1, 5);
    expect(calls).toBe(5);
    expect(rows).toHaveLength(5);
  });

  it("a row inserted at the top between two pages repeats one row; keyOf drops the repeat", async () => {
    // Newest-first table, 1500 rows. After page 1 is read a new row arrives at the
    // top, so every offset moves down by one and page 2 starts with the row page 1
    // ended on.
    const all = Array.from({ length: 1500 }, (_, i) => ({ id: 1500 - i }));
    let served = 0;
    const page = async (from: number, to: number) => {
      const data = all.slice(from, to + 1);
      if (++served === 1) all.unshift({ id: 9999 });
      return { data, error: null };
    };
    const plain = await fetchAllRows(page);
    const ids = plain.map((r) => r.id);
    expect(ids.length - new Set(ids).size).toBe(1); // one duplicate

    all.splice(0, 1); served = 0; // back to the original table
    const keyed = await fetchAllRows(page, 1000, 200, (r) => String(r.id));
    const kept = keyed.map((r) => r.id);
    expect(kept.length).toBe(new Set(kept).size);
    expect(kept).toHaveLength(1500);
  });

  it("the old single request would have lost rows (control)", async () => {
    const t = table(2500);
    const single = await t.page(0, 99999);
    expect(single.data).toHaveLength(1000);
  });
});
