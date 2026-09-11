import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { drizzle as betterDrizzle } from "drizzle-orm/better-sqlite3";
import { migrate as migrateLibSql } from "drizzle-orm/libsql/migrator";
import { migrate as migrateBetter } from "drizzle-orm/better-sqlite3/migrator";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@/db/schema";

/**
 * DB layer that supports two environments:
 *
 *   LOCAL  — DATABASE_URL is unset or starts with `file:` → better-sqlite3
 *            (synchronous, native, writable local file). e.g. `pnpm dev`.
 *   REMOTE — any other DATABASE_URL (e.g. `libsql://...` Turso) → @libsql/client
 *            over the network, so the app runs on read-only/serverless hosts
 *            like Vercel.
 *
 * Both are exposed through the async `LibSQLDatabase` type so all query/action
 * code can `await` uniformly. better-sqlite3 is synchronous, so `await` on it
 * is a harmless no-op — this keeps the sync local driver while allowing a real
 * async remote driver in production.
 */

// Resolve the raw configured URL (tree-shakable, no side effects).
function resolveUrl(): string {
  const raw = process.env.DATABASE_URL ?? "";
  if (!raw || raw.startsWith("file:")) return ""; // local file-backed sqlite
  return raw;
}

export function isLocal(): boolean {
  return resolveUrl() === "";
}

export const DB_PATH = path.join(process.cwd(), "data", "tableorder.db");

export function getDatabaseUrl(): string {
  return isLocal() ? `file:${DB_PATH}` : resolveUrl();
}

type Db = LibSQLDatabase<typeof schema>;

// Keep references to the concrete (un-cast) instances for migrations/close.
let betterDb: BetterSQLite3Database<typeof schema> | null = null;
let libsqlDb: LibSQLDatabase<typeof schema> | null = null;
let libsqlClient: Client | null = null;

function createLocalClient(): Db {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  betterDb = betterDrizzle(sqlite, { schema });
  // Cast the sync driver to the async LibSQL type so callers `await` uniformly.
  return betterDb as unknown as Db;
}

function createRemoteClient(): Db {
  const client = createClient({ url: resolveUrl() });
  libsqlClient = client;
  libsqlDb = drizzle(client, { schema });
  return libsqlDb;
}

function initClient() {
  if (isLocal()) return createLocalClient();
  return createRemoteClient();
}

// Cache across HMR in dev; single instance in production.
const globalForDb = globalThis as unknown as { __tableorderDb?: Db };
const db = globalForDb.__tableorderDb ?? initClient();
if (process.env.NODE_ENV !== "production") globalForDb.__tableorderDb = db;

/** Apply pending drizzle migrations to the active database (local or remote). */
export async function migrateDb(migrationsFolder = path.join(process.cwd(), "drizzle")): Promise<void> {
  if (isLocal()) {
    if (!betterDb) throw new Error("Local DB client not initialised.");
    migrateBetter(betterDb, { migrationsFolder });
  } else {
    if (!libsqlDb) throw new Error("Remote DB client not initialised.");
    await migrateLibSql(libsqlDb, { migrationsFolder });
  }
}

/** Close the underlying connection (used by CLI scripts on exit). */
export async function closeDb(): Promise<void> {
  if (isLocal()) {
    // better-sqlite3 native handle — closed via the underlying Database.
    // We don't hold it here; SQLite flushes safely on process exit.
  } else if (libsqlClient) {
    try {
      await libsqlClient.close();
    } catch {
      /* closing is best-effort */
    }
  }
}

export { db, schema };
export type {
  Restaurant,
  DiningTable,
  MenuCategory,
  MenuItem,
  MenuItemVariant,
  TableSession,
  Order,
  OrderItem,
  Bill,
} from "@/db/schema";