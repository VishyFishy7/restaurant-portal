import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Staff" };

const STAFF = [
  { name: "Owner", username: "owner", role: "owner", blurb: "Full access to all settings and reports." },
  { name: "Manager", username: "manager", role: "manager", blurb: "Menu, tables, billing and staff management." },
  { name: "Waiter 1", username: "waiter1", role: "waiter", blurb: "Takes and serves orders; sees the live board." },
  { name: "Kitchen 1", username: "kitchen1", role: "kitchen", blurb: "Sees the kitchen board and marks items preparing/ready." },
];

const ROLE_BADGE: Record<string, string> = { owner: "Owner", manager: "Manager", waiter: "Waiter", kitchen: "Kitchen" };

export default function StaffPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Staff</h1>
        <p className="text-sm text-muted-foreground">Example roster for Demo Kitchen (local mock — no auth yet).</p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        {STAFF.map((s) => (
          <Card key={s.username}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{s.name}</CardTitle>
                <Badge variant="outline">{ROLE_BADGE[s.role] ?? s.role}</Badge>
              </div>
              <CardDescription>Username: <span className="font-mono text-xs">{s.username}</span></CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{s.blurb}</CardContent>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Spec credentials: all staff passwords <code className="rounded bg-muted px-1">Password123!</code>. Authentication and roles
        are out of scope for this local SQLite build.
      </p>
    </div>
  );
}