/**
 * Read every row of a query that the API would otherwise cut off.
 *
 * Supabase's REST layer returns at most `max_rows` rows per request (1000 unless
 * the project changed it), silently: no error, just fewer rows. Anything that adds
 * the rows up on the client, such as a balance per user, is then wrong once the
 * table passes that size, with nothing to show it. Pass a function that fetches
 * one page with `.range(from, to)` on a query with a stable, total `.order()`
 * (a tie on the sort column can skip or repeat a row between pages).
 *
 * Offset paging can repeat a row when another row is inserted ahead of the cursor
 * between two pages (a newest-first list gaining a row at the top). Pass `keyOf`
 * to drop a row already seen; it cannot recover a row skipped by a deletion, which
 * is why the orderings used by callers put new rows last where they can.
 *
 * Stops at the first short page. `maxPages` is a guard against a loop, not a limit
 * anyone should reach. A failed page ends the read and returns what was read, which
 * is what the callers did before for a failed single request (they treated it as
 * no rows), but it is logged.
 */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 1000,
  maxPages = 200,
  keyOf?: (row: T) => string,
): Promise<T[]> {
  return (await fetchAllRowsChecked(page, pageSize, maxPages, keyOf)).rows;
}

/**
 * Same read, but says whether it is the whole table. `complete` is false when a
 * page failed or when `maxPages` ran out while pages were still full; the rows
 * are then only a prefix. Anything that adds the rows up (a balance) must check it
 * and must not present the sum as verified when it is false.
 */
export async function fetchAllRowsChecked<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 1000,
  maxPages = 200,
  keyOf?: (row: T) => string,
): Promise<{ rows: T[]; complete: boolean }> {
  const rows: T[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < maxPages; i++) {
    const from = i * pageSize;
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) {
      console.error("[fetchAllRows] page failed; returning the rows read so far", { page: i });
      return { rows, complete: false };
    }
    const got = data ?? [];
    for (const row of got) {
      if (keyOf) {
        const key = keyOf(row);
        if (seen.has(key)) continue;
        seen.add(key);
      }
      rows.push(row);
    }
    if (got.length < pageSize) return { rows, complete: true };
  }
  return { rows, complete: false };
}
