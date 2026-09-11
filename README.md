# tableorder · restaurant-portal

QR ordering for small restaurants, cafes and dhabas. Local SQLite build with a
greyscale wireframe design system (no external services — no Supabase/Razorpay yet).

- **Customer panel** `/t/<qrToken>` — no-login menu, cart (localStorage), variants,
  2-minute cancellation window, first-order approval gate, live polling.
- **Restaurant portal** `/admin` — dashboard, live board, billing (GST 5% split +
  service charge + round-off, 80mm print), Total Orders, Menu, Tables & QR
  (16-char base62 tokens), Staff (mock), Settings.
- **Staff board** `/staff` — kitchen board with large touch targets.

## Stack

Next.js 15 (App Router, `src/`, TypeScript strict, Tailwind v4, ESLint) · shadcn/ui
(radix base) · drizzle-orm + SQLite · sonner toasts.

Two DB drivers, chosen at runtime from `DATABASE_URL`:

- **Local** (no `DATABASE_URL`, or `file:`): `better-sqlite3` — synchronous
  native file DB at `data/tableorder.db`. Used for `pnpm dev`.
- **Production / Vercel** (`libsql://...` Turso): `@libsql/client` over the
  network — works on Vercel's read-only serverless filesystem.

Both share one async API (`src/db/client.ts`).

## Getting started

```bash
pnpm install
pnpm db:setup        # generate + apply migration, seed Demo Kitchen (6 tables, 4 categories, 16 items)
pnpm dev
```

Open `http://localhost:3000` → click any table to try the customer menu, or open the
admin panel directly.

## Scripts

| Script | Purpose |
|---|---|
| `pnpm dev` | dev server (Turbopack) |
| `pnpm build` | production build (also runs lint + typecheck) |
| `pnpm db:generate` | generate drizzle migration from `src/db/schema.ts` |
| `pnpm db:seed` | seed demo data (idempotent; skips if restaurant exists) |
| `pnpm db:setup` | generate + seed |

## Deploy to Vercel

One-click import:

1. Push this repo to GitHub, then open **https://vercel.com/new** →
   **Import Git Repository** → pick `restaurant-portal`. Vercel auto-detects
   Next.js; the build command is `pnpm build`.
2. **Decide on a database** (optional for a demo):
   - **Skip it / demo:** don't set `DATABASE_URL`. The site builds and loads,
     but data pages show *"No data — run `pnpm db:setup`"* until a DB exists.
   - **Use Turso (recommended):**
     1. Create a free database at **https://turso.tech** (any region).
     2. In your Vercel project → **Settings → Environment Variables**, add:
        | Name | Value |
        |---|---|
        | `DATABASE_URL` | `libsql://<your-db>-<owner>.turso.io` |
        | `DATABASE_AUTH_TOKEN` | your Turso DB auth token (from *Settings → Database tokens*) |
     3. **Deploy**, then run migrations + seed against the live DB from your machine:
        ```bash
        DATABASE_URL="libsql://<your-db>-<owner>.turso.io" DATABASE_AUTH_TOKEN="<token>" pnpm db:setup
        ```
        (Or use the Vercel build step / `pnpm db:push` — `db:setup` is idempotent.)
3. **Deploy.** The app now uses `@libsql/client` on Vercel (network, no native
   modules, no local file writes), so it runs on Vercel's read-only serverless
   filesystem.

Notes:

- `better-sqlite3` is never used in production — Vercel's filesystem is
  read-only and ephemeral, so a local file DB cannot persist there.
- Every order/bill/menu change persists only if `DATABASE_URL` points at an
  external (Turso) DB. Without it, all pages read from a throwaway local DB.
- See `.env.example` for the full variable reference.

## Notes

- Money is **integer paise** end to end; totals round to the nearest ₹5 at the bill
  layer. Format only at display time (`src/lib/money.ts`).
- The SQLite database lives at `data/tableorder.db` (gitignored). Re-run
  `pnpm db:seed` after deleting it to rebuild demo data.
- Original HTML wireframes are preserved in `wireframe_backup/` (also in git history).
- Design tokens (greyscale) live in `src/app/globals.css` — ink `#111827`, paper
  `#F3F4F6`, surface `#FFFFFF`, line `#E5E7EB`, muted `#6B7280`.