"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, CookingPot, Flame, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getLive, updateItemStatus, approvePendingOrders } from "@/lib/actions";
import type { LiveTable } from "@/lib/queries";

const step = (status: string): string[] => {
  if (status === "placed") return ["preparing"];
  if (status === "preparing") return ["ready"];
  if (status === "ready") return ["served"];
  return [];
};

const stepLabel: Record<string, string> = {
  placed: "Start",
  preparing: "Ready",
  ready: "Serve",
};

const itemBadge = (status: string) => {
  const m: Record<string, string> = { placed: "text-foreground", preparing: "", ready: "", served: "", cancelled: "line-through text-muted-foreground" };
  return m[status] ?? "";
};

export default function LiveBoard() {
  const [data, setData] = useState<LiveTable[] | null>(null);
  const busy = useRef<Record<string, boolean>>({});

  const load = useCallback(async () => {
    const d = await getLive();
    setData(d);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  const act = async (key: string, fn: () => Promise<{ ok: boolean; error?: string }>) => {
    if (busy.current[key]) return;
    busy.current[key] = true;
    const res = await fn();
    busy.current[key] = false;
    if (!res.ok) toast.error(res.error ?? "Action failed");
    load();
  };

  if (!data)
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    );

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Live board</h1>
        <p className="text-sm text-muted-foreground">Table-by-table order status · refreshes every 4 s</p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((t) => (
          <Card key={t.table.id} className={`${t.session ? "border-l-4 border-l-ink" : ""} p-4`}>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-lg font-bold">{t.table.label}</span>
              {!t.session ? (
                <Badge variant="secondary">Free</Badge>
              ) : t.session.approval_status === "pending" ? (
                <Badge>Needs approval</Badge>
              ) : (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ShoppingBag className="h-3.5 w-3.5" />
                  {new Date(t.session.opened_at + "Z").toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>

            {!t.session ? (
              <p className="text-sm text-muted-foreground">No session open.</p>
            ) : (
              <div className="flex max-h-64 flex-col gap-3 overflow-y-auto">
                {/* Standalone pending-approval banner shown once */}
                {t.session.approval_status === "pending" && (
                  <div className="flex items-center justify-between rounded-md border border-ink/40 bg-paper p-2 text-xs">
                    <span>New session awaiting approval</span>
                    <Button
                      size="xs"
                      onClick={() => act(`ape-${t.session!.id}`, () => approvePendingOrders(t.orders.filter((o) => o.status === "pending_approval").map((o) => o.id)))}
                    >
                      Approve
                    </Button>
                  </div>
                )}
                {t.orders.map((o) => (
                  <div key={o.id} className="rounded-md border border-line bg-paper/60 p-2">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-xs font-semibold">Round {o.order_number}</span>
                      {o.status === "pending_approval" ? <Badge variant="outline" className="text-[10px]">pending</Badge> : null}
                    </div>
                    <ul className="flex flex-col gap-1.5">
                      {o.items.map((it) => (
                        <li key={it.id} className={`flex items-center justify-between gap-2 text-sm ${itemBadge(it.status)}`}>
                          <span className="min-w-0 truncate">
                            {it.quantity}× {it.item_name}
                            {it.variant_name ? <span className="text-muted-foreground"> ({it.variant_name})</span> : null}
                          </span>
                          <StageButton status={it.status} onAct={(s) => act(`i${it.id}`, () => updateItemStatus(it.id, s))} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function StageButton({ status, onAct }: { status: string; onAct: (s: string) => void }) {
  const next = step(status);
  if (status === "served")
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <Check className="h-3.5 w-3.5" /> Served
      </span>
    );
  if (status === "cancelled") return <span className="text-xs line-through">—</span>;
  if (!next.length)
    return (
      <Badge variant="outline" className="text-[10px]">
        {status}
      </Badge>
    );
  const Icon = next[0] === "ready" ? CookingPot : next[0] === "served" ? Check : Flame;
  return (
    <Button size="xs" onClick={() => onAct(next[0])}>
      <Icon className="h-3 w-3" /> {stepLabel[next[0]] ?? next[0]}
    </Button>
  );
}