"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getSettings, updateSettings } from "@/lib/actions";

type Settings = NonNullable<Awaited<ReturnType<typeof getSettings>>>;

export default function SettingsClient() {
  const [s, setS] = useState<Settings | null>(null);
  const [form, setForm] = useState({ gst_rate: "5", service_charge_pct: "10", approval_required: true, cancel_window: "120" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSettings().then((d) => {
      setS(d);
      if (d)
        setForm({
          gst_rate: String(d.gst_rate),
          service_charge_pct: String(d.service_charge_pct),
          approval_required: d.approval_required,
          cancel_window: String(d.customer_cancel_window_seconds),
        });
    });
  }, []);

  const save = async () => {
    setSaving(true);
    const res = await updateSettings({
      gst_rate: Number(form.gst_rate) || 0,
      service_charge_pct: Number(form.service_charge_pct) || 0,
      approval_required: form.approval_required,
      customer_cancel_window_seconds: Number(form.cancel_window) || 0,
    });
    setSaving(false);
    if (!res.ok) return toast.error(res.error ?? "Save failed.");
    toast.success("Settings saved.");
  };

  if (!s) return <Skeleton className="h-64" />;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Restaurant billing &amp; order behaviour.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Billing</CardTitle>
          <CardDescription>All money is integer paise; totals round to the nearest ₹5.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="mb-1 block text-xs font-medium text-muted-foreground">GST rate (%)</Label>
              <Input type="number" value={form.gst_rate} onChange={(e) => setForm({ ...form, gst_rate: e.target.value })} />
            </div>
            <div>
              <Label className="mb-1 block text-xs font-medium text-muted-foreground">Service charge (%)</Label>
              <Input type="number" value={form.service_charge_pct} onChange={(e) => setForm({ ...form, service_charge_pct: e.target.value })} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Orders</CardTitle>
          <CardDescription>Who can order and for how long they can cancel.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <label className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="text-sm font-medium">Require staff approval</div>
              <div className="text-xs text-muted-foreground">Block first order of a new session to deter pranks.</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.approval_required}
              onClick={() => setForm({ ...form, approval_required: !form.approval_required })}
              className={`relative h-6 w-11 rounded-full transition-colors ${form.approval_required ? "bg-ink" : "bg-line"}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${form.approval_required ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </label>
          <div>
            <Label className="mb-1 block text-xs font-medium text-muted-foreground">Customer cancellation window (seconds)</Label>
            <Input type="number" value={form.cancel_window} onChange={(e) => setForm({ ...form, cancel_window: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving} className="w-fit">
        {saving ? "Saving…" : "Save settings"}
      </Button>
    </div>
  );
}