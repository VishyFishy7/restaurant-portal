"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy, Printer, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getTablesList, regenerateQrToken } from "@/lib/actions";

type Data = Awaited<ReturnType<typeof getTablesList>>;

export default function TablesClient() {
  const [data, setData] = useState<Data | null>(null);

  const load = async () => setData(await getTablesList());
  useEffect(() => {
    load();
  }, []);

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(`${location.origin}/t/${token}`);
      toast.success("QR link copied.");
    } catch {
      toast.error("Copy failed.");
    }
  };

  const regen = async (tableId: number) => {
    const res = await regenerateQrToken(tableId);
    if (!res.ok) return toast.error(res.error ?? "Failed");
    toast.success("New QR token generated.");
    load();
  };

  if (!data)
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tables &amp; QR</h1>
          <p className="text-sm text-muted-foreground">16-char base62 tokens · <span className="font-mono">/t/&lt;token&gt;</span></p>
        </div>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print QR sheet
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {data.tables.map((t) => (
          <Card key={t.id} className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <div className="font-semibold">{t.label}</div>
              <Link href={`/t/${t.qr_token}`} className="block truncate font-mono text-xs text-muted-foreground hover:text-foreground hover:underline">
                /t/{t.qr_token}
              </Link>
              <div className="mt-2 flex gap-2">
                <Button size="xs" variant="outline" onClick={() => copy(t.qr_token)}>
                  <Copy className="h-3 w-3" /> Copy link
                </Button>
                <Button size="xs" variant="outline" onClick={() => regen(t.id)}>
                  <RefreshCw className="h-3 w-3" /> Regenerate
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Hidden print sheet: each QR card = table label + token */}
      <div id="print-area" className="hidden bg-white text-black">
        <div className="mb-2 text-center text-lg font-bold">{data.restaurant?.name} — QR cards</div>
        {data.tables.map((t) => (
          <div key={t.id} className="mb-4 rounded-md border border-black p-3">
            <div className="text-base font-bold">{t.label}</div>
            <div className="font-mono text-sm">{t.qr_token}</div>
            <div className="mt-1 text-xs">Scan to open the menu</div>
          </div>
        ))}
      </div>
    </div>
  );
}