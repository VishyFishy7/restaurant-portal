import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { db, schema } from "@/db";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const tables = await db.select().from(schema.diningTables).orderBy(desc(schema.diningTables.table_number)).all();
  const restaurant = await db.select().from(schema.restaurants).limit(1).get();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-6">
      <header className="mb-8 flex items-center justify-between">
        <div className="text-2xl font-extrabold tracking-tight">tableorder</div>
        <Badge variant="outline">local build</Badge>
      </header>

      <section className="mb-10">
        <h1 className="mb-2 text-3xl font-bold tracking-tight sm:text-4xl">{restaurant?.name ?? "Demo Kitchen"}</h1>
        <p className="text-muted-foreground">
          QR ordering for small restaurants — a working Next.js + SQLite prototype replacing the original HTML wireframes.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Customer menu</CardTitle>
            <CardDescription>Scan a table QR to order from a phone — no login, cart, variants, cancellation window.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {restaurant ? (
              <>
                <div className="mb-1 flex flex-wrap gap-2">
                  {tables.map((t) => (
                    <Link key={t.id} href={`/t/${t.qr_token}`}>
                      <Button variant="outline" size="sm" className="tabular-nums">
                        {t.label}
                      </Button>
                    </Link>
                  ))}
                </div>
                <Button asChild>
                  <Link href={`/t/${tables[0]?.qr_token ?? ""}`}>Open demo table menu</Link>
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No data — run <code className="rounded bg-muted px-1">pnpm db:setup</code>.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Restaurant portal</CardTitle>
            <CardDescription>Dashboard, live order board, billing with GST split, Total Orders, menu, tables &amp; QR, staff, settings.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button asChild className="w-full">
              <Link href="/admin">Open admin panel</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/staff">Open staff board</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <footer className="mt-auto pt-10 text-xs text-muted-foreground">
        Greyscale wireframe design system (§16.2) · local SQLite only — no external services.
      </footer>
    </main>
  );
}