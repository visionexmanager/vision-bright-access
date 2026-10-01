import { createPgDb, runMigrations } from "./db.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const db = await createPgDb(url, ["1", "true"].includes(process.env.DATABASE_SSL ?? ""));
const ran = await runMigrations(db, join(dirname(fileURLToPath(import.meta.url)), "..", "migrations"));
console.log(ran.length ? `applied: ${ran.join(", ")}` : "up to date");
await db.close();
