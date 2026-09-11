import { defineConfig } from "drizzle-kit";

// Local: DATABASE_URL unset → file-backed SQLite via better-sqlite3.
// Remote (Vercel/Turso): DATABASE_URL = `libsql://<db>-<org>.turso.io`.
// Optional DATABASE_AUTH_TOKEN for the Turso database auth token.
const url = process.env.DATABASE_URL || "./data/tableorder.db";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url,
    ...(process.env.DATABASE_AUTH_TOKEN ? { authToken: process.env.DATABASE_AUTH_TOKEN } : {}),
  },
});