"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, CookingPot, Flame } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getLive, updateItemStatus } from "@/lib/actions";
import type { LiveTable } from "@/lib/queries";

function nextAction(status: string): string | null {
  if (status === "placed") return "preparing";
  if (status === "preparing") return "ready";
  return null;
}
function actionLabel(status: string): { label: string; Icon: typeof Flame } {
  if (status === "placed") return { label: "Start preparing", Icon: Flame };
  return { label: "Mark ready", Icon: CookingPot };
}

export default function StaffBoard() {
  const [data, setData] = useState<LiveTable[] | null>(null);
  const busy = useRef<Record<string, boolean>>({});

  const load = useCallback(async () => setData(await getLive()), []);
  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  const act = async (key: string, status: string) => {
    if (busy.current[key]) return;
    busy.current[key] = true;
    const res = await updateItemStatus(Number(key), status);
    busy.current[key] = false;
    if (!res.ok) toast.error(res.error ?? "Failed");
    load();
  };

  if (!data)
    return (
      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    );

  return (
    <div className="min-h-dvh bg-paper">
      <header className="sticky top-0 z-20 border-b bg-surface px-4 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-baseline gap-3">
            <span className="text-xl font-extrabold tracking-tight">tableorder</span>
            <span className="text-sm font-medium text-muted-foreground">Kitchen board</span>
          </div>
          <Link href="/" className="text-xs text-muted-foreground hover:underline">
            ← Home
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-3 p-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {data.map((t) => {
          const activeOrders = t.orders.filter((o) => o.items.some((i) => i.status !== "served" && i.status !== "cancelled"));
          return (
            <div
              key={t.table.id}
              className={`rounded-xl border bg-surface p-3 ${activeOrders.length ? "border-l-4 border-l-ink" : "border-line"}`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xl font-bold">{t.table.label}</span>
                {!t.session ? (
                  <span className="rounded bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">Free</span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {t.orders.length} round{t.orders.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>

              {!t.session || activeOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active orders.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {activeOrders.map((o) =>
                    o.items
                      .filter((i) => i.status !== "served" && i.status !== "cancelled")
                      .map((it) => {
                        const next = nextAction(it.status);
                        const { label, Icon } = actionLabel(it.status);
                        return (
                          <div key={it.id} className="rounded-lg border border-line bg-paper/60 p-2">
                            <div className="mb-1 text-base font-semibold leading-tight">
                              {it.quantity}× {it.item_name}
                              {it.variant_name ? <span className="text-sm font-normal text-muted-foreground"> ({it.variant_name})</span> : null}
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="rounded bg-muted px-1.5 py-0.5 text-xs capitalize text-muted-foreground">{it.status}</span>
                              {next ? (
                                <Button size="sm" onClick={() => act(String(it.id), next)}>
                                  <Icon className="h-3.5 w-3.5" /> {label}
                                </Button>
                              ) : (
                                <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                                  <Check className="h-3.5 w-3.5" /> Done
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      }),
                  )}
                </div>
              )}
            </div>
          );
        })}
      </main>
    </div>
  );
}