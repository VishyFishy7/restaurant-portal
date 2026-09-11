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
(radix base) · drizzle-orm + better-sqlite3 (local file DB) · sonner toasts.

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

## Notes

- Money is **integer paise** end to end; totals round to the nearest ₹5 at the bill
  layer. Format only at display time (`src/lib/money.ts`).
- The SQLite database lives at `data/tableorder.db` (gitignored). Re-run
  `pnpm db:seed` after deleting it to rebuild demo data.
- Original HTML wireframes are preserved in `wireframe_backup/` (also in git history).
- Design tokens (greyscale) live in `src/app/globals.css` — ink `#111827`, paper
  `#F3F4F6`, surface `#FFFFFF`, line `#E5E7EB`, muted `#6B7280`.