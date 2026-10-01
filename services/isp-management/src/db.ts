import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface Queryable {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number }>;
}
export interface Db extends Queryable {
  tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
  /** Multi-statement script (migrations). */
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

export async function createPgDb(url: string, ssl: boolean): Promise<Db> {
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({
    connectionString: url,
    ssl: ssl ? { rejectUnauthorized: true } : undefined,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 15_000,
  });
  const wrap = (c: { query: (s: string, p?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }> }): Queryable => ({
    query: async (sql, params) => {
      const r = await c.query(sql, params);
      return { rows: r.rows as never[], rowCount: r.rowCount ?? 0 };
    },
  });
  return {
    ...wrap(pool),
    async tx(fn) {
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        const out = await fn(wrap(c));
        await c.query("COMMIT");
        return out;
      } catch (e) {
        await c.query("ROLLBACK").catch(() => undefined);
        throw e;
      } finally {
        c.release();
      }
    },
    async exec(sql) {
      await pool.query(sql);
    },
    close: () => pool.end(),
  };
}

/** In-process PostgreSQL for tests (real SQL semantics, no daemon). */
export async function createPgliteDb(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const lite = new PGlite();
  await lite.waitReady;
  const wrap = (c: { query: (s: string, p?: unknown[]) => Promise<{ rows: unknown[]; affectedRows?: number }> }): Queryable => ({
    query: async (sql, params) => {
      const r = await c.query(sql, params);
      return { rows: r.rows as never[], rowCount: r.affectedRows || r.rows.length };
    },
  });
  return {
    ...wrap(lite),
    tx: (fn) => lite.transaction((t) => fn(wrap(t))),
    exec: async (sql) => void (await lite.exec(sql)),
    close: () => lite.close(),
  };
}

export async function runMigrations(db: Db, dir: string): Promise<string[]> {
  await db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const applied = new Map(
    (await db.query<{ name: string; checksum: string }>("SELECT name, checksum FROM schema_migrations")).rows.map((r) => [r.name, r.checksum]),
  );
  const ran: string[] = [];
  const files = readdirSync(dir).filter((f) => /^\d+_.*\.sql$/.test(f) && !f.endsWith(".down.sql")).sort();
  for (const f of files) {
    // The checksum must not depend on the checkout's line endings.
    const sql = readFileSync(join(dir, f), "utf8").replaceAll("\r\n", "\n");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const prior = applied.get(f);
    if (prior) {
      if (prior !== checksum) throw new Error(`migration ${f} was edited after being applied`);
      continue;
    }
    await db.exec("BEGIN;\n" + sql + "\nCOMMIT;");
    await db.query("INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)", [f, checksum]);
    ran.push(f);
  }
  return ran;
}
