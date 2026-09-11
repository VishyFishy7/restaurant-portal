"use client";

import { useEffect, useState } from "react";
import { Printer, CheckCircle2, Receipt } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { getBillingData, generateBill, setBillPayment } from "@/lib/actions";
import { inr } from "@/lib/money";

type Data = Awaited<ReturnType<typeof getBillingData>>;
type Generated = { billId: number; total: number; invoice: string };

export default function BillingClient() {
  const [data, setData] = useState<Data | null>(null);
  const [openSession, setOpenSession] = useState<Data["open"][number] | null>(null);
  const [generated, setGenerated] = useState<Generated | null>(null);
  const [payMode, setPayMode] = useState("cash");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      const d = await getBillingData();
      if (alive) setData(d);
    }
    load();
    const t = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const doGenerate = async (sessionId: number) => {
    setBusy(true);
    const res = await generateBill(sessionId);
    setBusy(false);
    if (!res.ok) return toast.error(res.error ?? "Could not generate bill.");
    setGenerated({ billId: res.data!.billId as number, total: res.data!.total as number, invoice: res.data!.invoice as string });
    setOpenSession(null);
  };

  const doPay = async (billId: number, mode: string) => {
    setBusy(true);
    await setBillPayment(billId, mode, true);
    setBusy(false);
    setGenerated(null);
    toast.success("Marked as paid.");
    const d = await getBillingData();
    setData(d);
  };

  if (!data)
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-52" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="text-sm text-muted-foreground">
          GST {data.gst_rate}% · service {data.service_charge_pct}% · round-off to nearest ₹5
        </p>
      </header>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Open sessions · {data.open.length}</h2>
        {data.open.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">No open sessions to bill.</CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {data.open.map((s) => (
              <Card key={s.session_id}>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-base">{s.table_label}</CardTitle>
                  <Button size="sm" onClick={() => setOpenSession(s)}>
                    Generate bill
                  </Button>
                </CardHeader>
                <CardContent>
                  <ul className="flex flex-col divide-y">
                    {s.items.map((it) => (
                      <li key={it.id} className="flex items-center justify-between py-1.5 text-sm">
                        <span className="text-muted-foreground">
                          {it.quantity}× {it.item_name}
                          {it.variant_name ? ` (${it.variant_name})` : ""}
                        </span>
                        <span className="tabular-nums">{inr(it.amount)}</span>
                      </li>
                    ))}
                  </ul>
                  <Separator className="my-2" />
                  <div className="flex flex-col gap-1 text-sm">
                    <Row label="Subtotal" value={`${inr(s.subtotal)}`} />
                    <Row label={`GST ${data.gst_rate}%`} value={`+ ${inr(s.gst)}`} />
                    <Row label={`Service ${data.service_charge_pct}%`} value={`+ ${inr(s.service_charge)}`} />
                    <Row label="Round-off" value={`${s.round_off >= 0 ? "+" : ""} ${inr(s.round_off)}`} />
                    <div className="mt-1 flex items-center justify-between border-t pt-2 text-base font-bold">
                      <span>Total</span>
                      <span className="tabular-nums">{inr(s.total)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Recent bills · {data.closed.length}</h2>
        {data.closed.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">No bills generated yet.</CardContent>
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Invoice</th>
                  <th className="px-3 py-2">Table</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.closed.map((b) => (
                  <tr key={b.id}>
                    <td className="px-3 py-2 tabular-nums">{b.invoice_number}</td>
                    <td className="px-3 py-2">{b.table_label}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{inr(b.total)}</td>
                    <td className="px-3 py-2">
                      {b.payment_status === "paid" ? (
                        <span className="flex items-center gap-1 text-xs font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" /> {b.payment_mode?.toUpperCase() ?? "PAID"}
                        </span>
                      ) : (
                        <Badge variant="outline">Unpaid</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Bill generation dialog */}
      <Dialog open={!!openSession} onOpenChange={(o) => !o && setOpenSession(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bill for {openSession?.table_label}</DialogTitle>
            <DialogDescription>Confirm totals and generate the invoice.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1 text-sm">
            <Row label="Subtotal" value={inr(openSession?.subtotal ?? 0)} />
            <Row label="GST" value={`+ ${inr(openSession?.gst ?? 0)}`} />
            <Row label="Service charge" value={`+ ${inr(openSession?.service_charge ?? 0)}`} />
            <Row label="Round-off" value={inr(openSession?.round_off ?? 0)} />
            <div className="mt-1 flex items-center justify-between border-t pt-2 text-base font-bold">
              <span>Total</span>
              <span className="tabular-nums">{inr(openSession?.total ?? 0)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenSession(null)}>Cancel</Button>
            <Button disabled={busy} onClick={() => doGenerate(openSession!.session_id)}>
              Generate bill &amp; close session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print / payment dialog */}
      <Dialog open={!!generated} onOpenChange={(o) => !o && setGenerated(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Invoice ready</DialogTitle>
            <DialogDescription>{generated?.invoice}</DialogDescription>
          </DialogHeader>
          <div id="print-area" className="rounded-md border border-dashed bg-white p-3 text-sm">
            <div className="mb-1 text-center text-base font-bold">Demo Kitchen</div>
            <div className="mb-2 text-center text-xs text-muted-foreground">{generated?.invoice} · 80mm thermal</div>
            <Separator />
            <div className="flex items-center justify-between py-2 text-lg font-bold">
              <span>TOTAL</span>
              <span className="tabular-nums">{inr(generated?.total ?? 0)}</span>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Select value={payMode} onValueChange={setPayMode}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="card">Card</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex w-full gap-2">
              <Button variant="outline" className="flex-1" onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> Print
              </Button>
              <Button className="flex-1" disabled={busy} onClick={() => doPay(generated!.billId, payMode)}>
                <Receipt className="h-4 w-4" /> Mark paid
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}