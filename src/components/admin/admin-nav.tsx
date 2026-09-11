"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Activity, Receipt, ListChecks, UtensilsCrossed, Table2, Users, Settings, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/live", label: "Live", icon: Activity },
  { href: "/admin/billing", label: "Billing", icon: Receipt },
  { href: "/admin/total-orders", label: "Total Orders", icon: ListChecks },
  { href: "/admin/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/admin/tables", label: "Tables & QR", icon: Table2 },
  { href: "/admin/staff", label: "Staff", icon: Users },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  const links = NAV.map((n) => {
    const Icon = n.icon;
    return (
      <Link
        key={n.href}
        href={n.href}
        onClick={() => setOpen(false)}
        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          isActive(n.href) ? "bg-ink text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
      >
        <Icon className="h-4 w-4" />
        {n.label}
      </Link>
    );
  });

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r bg-surface md:block">
        <div className="flex h-full flex-col gap-1 p-4">
          <div className="mb-4 px-3 text-xl font-extrabold tracking-tight">tableorder</div>
          <div className="flex flex-col gap-1">{links}</div>
          <Link href="/" className="mt-auto px-3 pt-6 text-xs text-muted-foreground hover:underline">
            ← Back to home
          </Link>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b bg-surface px-4 py-3 md:hidden">
        <span className="text-lg font-extrabold tracking-tight">tableorder</span>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon-sm" aria-label="Open menu">
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-68">
            <SheetHeader>
              <SheetTitle>tableorder</SheetTitle>
            </SheetHeader>
            <ScrollArea className="h-full py-4">
              <div className="flex flex-col gap-1">{links}</div>
              <Link href="/" className="mt-6 inline-block px-3 text-xs text-muted-foreground hover:underline">
                ← Back to home
              </Link>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}