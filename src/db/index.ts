import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@/db/schema";

export const DB_PATH = path.join(process.cwd(), "data", "tableorder.db");

function createClient() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema });
}

// Cache across HMR in dev; single instance in production.
const globalForDb = globalThis as unknown as { __tableorderDb?: ReturnType<typeof createClient> };
const db = globalForDb.__tableorderDb ?? createClient();
if (process.env.NODE_ENV !== "production") globalForDb.__tableorderDb = db;

export { db, schema };
export type { Restaurant, DiningTable, MenuCategory, MenuItem, MenuItemVariant, TableSession, Order, OrderItem, Bill } from "@/db/schema";