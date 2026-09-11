"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { placeOrder, cancelItem, pollSession } from "@/lib/actions";
import { inr } from "@/lib/money";
import type { MenuPayload, SessionPayload } from "@/lib/queries";

type Props = { qrToken: string; payload: MenuPayload; sessionInitial: SessionPayload };
type CartEntry = { key: string; menuItemId: number; variantId: number | null; name: string; variantName: string | null; price: number; qty: number };

function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem("tableorder.device");
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem("tableorder.device", id);
  }
  return id;
}

const foodMark = (t: string) => (t === "non_veg" ? "Non-veg" : t === "egg" ? "Egg" : "Veg");

export default function CustomerMenu({ qrToken, payload, sessionInitial }: Props) {
  const { restaurant, table, categories } = payload;
  const [deviceId, setDeviceId] = useState("");
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [activeCat, setActiveCat] = useState(categories[0]?.id ?? 0);
  const [tab, setTab] = useState<"menu" | "orders">("menu");
  const [orders, setOrders] = useState(sessionInitial.orders);
  const [session, setSession] = useState(sessionInitial.session);
  const [note, setNote] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [variantItem, setVariantItem] = useState<{ id: number; name: string; variants: Array<{ id: number; name: string; price: number }> } | null>(null);
  const orderBusyRef = useRef<Record<number, boolean>>({});
  const [, force] = useState(0);

  const cartKey = `tableorder.cart.${qrToken}`;

  // Hydrate device + cart
  useEffect(() => {
    setDeviceId(getDeviceId());
    try {
      const raw = window.localStorage.getItem(cartKey);
      if (raw) setCart(JSON.parse(raw));
    } catch {
      /* ignore corrupt cart */
    }
  }, [cartKey]);

  const persistCart = useCallback(
    (next: CartEntry[]) => {
      setCart(next);
      try {
        window.localStorage.setItem(cartKey, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    [cartKey],
  );

  const refresh = useCallback(async () => {
    if (!deviceId) return;
    const s = await pollSession(qrToken, deviceId);
    setSession(s.session);
    setOrders(s.orders);
    force((x) => x + 1);
  }, [qrToken, deviceId]);

  // Poll every 4s
  useEffect(() => {
    if (!deviceId) return;
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [deviceId, refresh]);

  const cartCount = cart.reduce((s, e) => s + e.qty, 0);
  const cartTotal = cart.reduce((s, e) => s + e.price * e.qty, 0);

  const addItem = (itemId: number, name: string, price: number, variants: Array<{ id: number; name: string; price: number }>) => {
    if (variants.length) {
      setVariantItem({ id: itemId, name, variants });
      return;
    }
    const key = `${itemId}:null`;
    const existing = cart.find((e) => e.key === key);
    if (existing) persistCart(cart.map((e) => (e.key === key ? { ...e, qty: e.qty + 1 } : e)));
    else persistCart([...cart, { key, menuItemId: itemId, variantId: null, name, variantName: null, price, qty: 1 }]);
  };

  const addVariant = (variant: { id: number; name: string; price: number }) => {
    if (!variantItem) return;
    const key = `${variantItem.id}:${variant.id}`;
    const existing = cart.find((e) => e.key === key);
    if (existing) persistCart(cart.map((e) => (e.key === key ? { ...e, qty: e.qty + 1 } : e)));
    else persistCart([...cart, { key, menuItemId: variantItem.id, variantId: variant.id, name: variantItem.name, variantName: variant.name, price: variant.price, qty: 1 }]);
    setVariantItem(null);
  };

  const changeQty = (key: string, delta: number) => {
    persistCart(
      cart
        .map((e) => (e.key === key ? { ...e, qty: e.qty + delta } : e))
        .filter((e) => e.qty > 0),
    );
  };

  const removeLine = (key: string) => persistCart(cart.filter((e) => e.key !== key));

  const submitOrder = async () => {
    if (!deviceId || !cart.length) return;
    setPlacing(true);
    const res = await placeOrder(
      qrToken,
      deviceId,
      cart.map((e) => ({ menuItemId: e.menuItemId, variantId: e.variantId, qty: e.qty })),
      note || undefined,
    );
    setPlacing(false);
    if (!res.ok) {
      toast.error(res.error ?? "Could not place order.");
      return;
    }
    if (res.data?.pendingApproval) toast.info("Order placed — waiting for staff approval.");
    else toast.success("Order placed!");
    persistCart([]);
    setNote("");
    setCartOpen(false);
    setTab("orders");
    refresh();
  };

  const doCancel = async (itemId: number) => {
    if (orderBusyRef.current[itemId]) return;
    orderBusyRef.current[itemId] = true;
    const res = await cancelItem(qrToken, deviceId, itemId);
    orderBusyRef.current[itemId] = false;
    if (!res.ok) toast.error(res.error ?? "Could not cancel.");
    else toast.success("Item cancelled.");
    refresh();
  };

  const activeItems = categories.find((c) => c.id === activeCat)?.items ?? [];
  const pendingApproval = session?.approval_status === "pending";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col pb-28">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b bg-surface/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <div className="text-lg font-bold leading-tight">{restaurant.name}</div>
            <div className="text-xs text-muted-foreground">{table.label} · {restaurant.name}</div>
          </div>
          <button type="button" onClick={() => setTab("orders")} className="relative rounded-full border p-2" aria-label="My orders">
            <ShoppingBag className="h-5 w-5" />
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[10px] font-bold text-white">
              {orders.reduce((s, o) => s + o.items.length, 0)}
            </span>
          </button>
        </div>
      </header>

      {/* Menu / Orders tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as "menu" | "orders")} className="px-4 pt-3">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="menu">Menu</TabsTrigger>
          <TabsTrigger value="orders">My orders</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Orders view */}
      {tab === "orders" ? (
        <section className="flex flex-col gap-3 px-4 py-4">
          {pendingApproval && (
            <div className="rounded-lg border border-ink/40 bg-paper p-3 text-sm">
              <Badge className="mb-1">Needs approval</Badge>
              <p>This is your first order at {table.label}. Staff will approve it before cooking starts.</p>
            </div>
          )}
          {orders.length === 0 && (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              No orders yet — add items from the menu and place your order.
            </Card>
          )}
          {orders.map((o) => (
            <Card key={o.id} className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold">Round {o.order_number}</span>
                <StatusBadge status={o.status} />
              </div>
              {o.note ? <p className="mb-2 text-xs text-muted-foreground">Note: {o.note}</p> : null}
              <ul className="flex flex-col gap-2">
                {o.items.map((it) => {
                  const cancelable = it.status === "placed" && it.cancel_deadline !== null && Date.now() < it.cancel_deadline;
                  return (
                    <li key={it.id} className="flex items-start justify-between gap-2 text-sm">
                      <div className="flex-1">
                        <div className="font-medium">
                          {it.quantity}× {it.item_name}
                          {it.variant_name ? <span className="text-muted-foreground"> ({it.variant_name})</span> : null}
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <StatusBadge status={it.status} compact />
                          {cancelable ? (
                            <button
                              onClick={() => doCancel(it.id)}
                              className="text-xs font-medium underline underline-offset-2"
                            >
                              Cancel
                            </button>
                          ) : null}
                        </div>
                      </div>
                      <div className="tabular-nums text-sm">{inr(it.unit_price * it.quantity)}</div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </section>
      ) : (
        /* Menu view */
        <>
          {/* Category tabs (sticky horizontal) */}
          <div className="sticky top-[57px] z-10 -mx-4 overflow-x-auto border-b bg-background/95 px-4 py-2 backdrop-blur">
            <div className="flex gap-2">
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveCat(c.id)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                    activeCat === c.id ? "border-ink bg-ink text-white" : "border-line bg-surface"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <section className="flex flex-col gap-3 px-4 py-4">
            {activeItems.map((it) => {
              const disabled = it.is_available === 0;
              return (
                <Card key={it.id} className={`flex items-center justify-between gap-3 p-4 ${disabled ? "opacity-50" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{foodMark(it.veg_type)}</Badge>
                      <h3 className="truncate font-semibold">{it.name}</h3>
                    </div>
                    {it.description ? <p className="mb-1 text-xs text-muted-foreground">{it.description}</p> : null}
                    <div className="text-sm tabular-nums text-muted-foreground">
                      {it.variants.length ? `${inr(it.variants[0].price)}–${inr(it.variants[it.variants.length - 1].price)}` : inr(it.price)}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {disabled ? (
                      <Badge variant="secondary">Unavailable</Badge>
                    ) : (
                      <Button size="sm" onClick={() => addItem(it.id, it.name, it.price, it.variants)}>
                        <Plus className="h-4 w-4" /> {it.variants.length ? "Choose" : "Add"}
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </section>
        </>
      )}

      {/* Variant picker */}
      <Dialog open={!!variantItem} onOpenChange={(o) => !o && setVariantItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Choose {variantItem?.name}</DialogTitle>
            <DialogDescription>Select a portion.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {variantItem?.variants.map((v) => (
              <button
                key={v.id}
                onClick={() => addVariant(v)}
                className="flex items-center justify-between rounded-lg border border-line bg-surface px-4 py-3 text-left transition-colors hover:border-ink"
              >
                <span className="font-medium">{v.name}</span>
                <span className="tabular-nums text-sm text-muted-foreground">{inr(v.price)}</span>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVariantItem(null)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cart sheet */}
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto sm:mx-auto sm:max-w-[560px] sm:rounded-t-xl">
          <SheetHeader>
            <SheetTitle>Cart</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-3 py-4">
            {cart.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Your cart is empty.</p>
            ) : (
              cart.map((e) => (
                <div key={e.key} className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {e.name} {e.variantName ? <span className="text-muted-foreground">({e.variantName})</span> : null}
                    </div>
                    <div className="text-xs tabular-nums text-muted-foreground">{inr(e.price)} each</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon-sm" className="h-7 w-7" onClick={() => changeQty(e.key, -1)} aria-label="decrease">
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center text-sm tabular-nums">{e.qty}</span>
                    <Button variant="outline" size="icon-sm" className="h-7 w-7" onClick={() => changeQty(e.key, 1)} aria-label="increase">
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="w-16 text-right text-sm tabular-nums">{inr(e.price * e.qty)}</div>
                  <Button variant="ghost" size="icon-sm" className="h-7 w-7" onClick={() => removeLine(e.key)} aria-label="remove">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
          <Separator />
          <div className="py-3">
            <Input placeholder="Cooking note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <SheetFooter>
            <div className="flex w-full items-center justify-between">
              <span className="text-sm font-medium">Total</span>
              <span className="text-lg font-bold tabular-nums">{inr(cartTotal)}</span>
            </div>
            <Button className="w-full" disabled={!cart.length || placing} onClick={submitOrder}>
              {placing ? "Placing…" : "Place order"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Sticky cart bar */}
      {cartCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 p-3 sm:mx-auto sm:max-w-[560px]">
          <Button className="flex w-full justify-between" size="lg" onClick={() => setCartOpen(true)}>
            <span className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" /> {cartCount} item{cartCount > 1 ? "s" : ""}
            </span>
            <span className="tabular-nums">{inr(cartTotal)}</span>
          </Button>
        </div>
      )}
    </main>
  );
}

function StatusBadge({ status, compact }: { status: string; compact?: boolean }) {
  const map: Record<string, string> = {
    pending_approval: "Needs approval",
    accepted: "Accepted",
    completed: "Completed",
    placed: "Placed",
    preparing: "Preparing",
    ready: "Ready",
    served: "Served",
    cancelled: "Cancelled",
  };
  return (
    <span className={`${compact ? "text-[10px]" : "text-xs"} rounded border border-line bg-paper px-1.5 py-0.5 font-medium`}>
      {map[status] ?? status}
    </span>
  );
}