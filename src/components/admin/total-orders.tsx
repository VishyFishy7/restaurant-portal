"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { getTotalOrders } from "@/lib/actions";
import { inr } from "@/lib/money";

type Orders = Awaited<ReturnType<typeof getTotalOrders>>;

export default function TotalOrders() {
  const [data, setData] = useState<Orders | null>(null);

  useEffect(() => {
    getTotalOrders().then(setData);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Total Orders</h1>
        <p className="text-sm text-muted-foreground">Completed (billed) sessions</p>
      </header>

      {!data ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          No completed orders yet — generate a bill from a live session to see it here.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Table</th>
                <th className="px-3 py-2">Invoice</th>
                <th className="px-3 py-2">Rounds</th>
                <th className="px-3 py-2 text-right">Items</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2">Closed</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((o) => (
                <tr key={o.session_id}>
                  <td className="px-3 py-2 font-medium">{o.table_label}</td>
                  <td className="px-3 py-2 tabular-nums">{o.invoice ?? <Badge variant="outline">—</Badge>}</td>
                  <td className="px-3 py-2 tabular-nums">{o.rounds}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{o.item_count}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{o.bill_total !== null ? inr(o.bill_total) : "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {o.closed_at ? new Date(o.closed_at + "Z").toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}