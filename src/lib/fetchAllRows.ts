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
 * Stops at the first short page. `maxPages` is a guard against a loop, not a limit
 * anyone should reach. A failed page ends the read and returns what was read, which
 * is what the callers did before for a failed single request (they treated it as
 * no rows), but it is logged.
 */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 1000,
  maxPages = 200,
): Promise<T[]> {
  const rows: T[] = [];
  for (let i = 0; i < maxPages; i++) {
    const from = i * pageSize;
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) {
      console.error("[fetchAllRows] page failed; returning the rows read so far", { page: i });
      break;
    }
    const got = data ?? [];
    rows.push(...got);
    if (got.length < pageSize) break;
  }
  return rows;
}
