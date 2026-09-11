"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, CheckSquare, Clock, IndianRupee, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getStats, getOpenSessions } from "@/lib/actions";
import { inr } from "@/lib/money";

type Stats = Awaited<ReturnType<typeof getStats>>;
type Session = Awaited<ReturnType<typeof getOpenSessions>>[number];

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card className="border-l-2 border-l-ink">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    let alive = true;
    async function load() {
      const [s, sess] = await Promise.all([getStats(), getOpenSessions()]);
      if (!alive) return;
      setStats(s);
      setSessions(sess);
    }
    load();
    const t = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Demo Kitchen · live overview (auto-refreshes every 5 s)</p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats ? (
          <>
            <StatCard label="Open tables" value={String(stats.openTables)} icon={<Activity className="h-4 w-4 text-muted-foreground" />} />
            <StatCard label="Pending approvals" value={String(stats.pendingApprovals)} icon={<Clock className="h-4 w-4 text-muted-foreground" />} />
            <StatCard label="Items in progress" value={String(stats.inProgressItems)} icon={<CheckSquare className="h-4 w-4 text-muted-foreground" />} />
            <StatCard label="Revenue (billed)" value={inr(stats.revenue)} icon={<IndianRupee className="h-4 w-4 text-muted-foreground" />} />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Live sessions</CardTitle>
            <CardDescription>Tables currently seated</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/live">Open live board</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No open sessions — scan a table QR to start one.</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {sessions.map((s) => (
                <li key={s.session_id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{s.table_label}</span>
                    {s.approval_status === "pending" ? <Badge variant="outline">approval pending</Badge> : null}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{s.order_count} round{s.order_count === 1 ? "" : "s"}</span>
                    <span>·</span>
                    <span>{new Date(s.opened_at + "Z").toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}