"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { getMenuAdmin, toggleItemAvailability, createItem } from "@/lib/actions";
import { inr } from "@/lib/money";

type Menu = NonNullable<Awaited<ReturnType<typeof getMenuAdmin>>>;

const foodMark = (t: string) => (t === "non_veg" ? "Non-veg" : t === "egg" ? "Egg" : "Veg");

export default function MenuClient() {
  const [data, setData] = useState<Menu | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [price, setPrice] = useState("");
  const [veg, setVeg] = useState("veg");

  const load = async () => setData(await getMenuAdmin());

  useEffect(() => {
    load();
  }, []);

  const toggle = async (itemId: number) => {
    const res = await toggleItemAvailability(itemId);
    if (!res.ok) toast.error(res.error ?? "Failed");
    load();
  };

  const submit = async () => {
    if (!name.trim() || !categoryId || !price) return toast.error("Fill all fields.");
    const paise = Math.round(parseFloat(price) * 100);
    const res = await createItem({ name, categoryId: Number(categoryId), pricePaise: paise, veg_type: veg });
    if (!res.ok) return toast.error(res.error ?? "Could not add item.");
    toast.success("Item added.");
    setOpen(false);
    setName("");
    setPrice("");
    load();
  };

  if (!data)
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-40" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Menu</h1>
          <p className="text-sm text-muted-foreground">{data.restaurant.name}</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Add item
        </Button>
      </header>

      {data.categories.map((c) => {
        const items = data.items.filter((i) => i.category_id === c.id);
        return (
          <Card key={c.id}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                {c.name}
                <Badge variant="outline">{items.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col divide-y">
              {items.length === 0 ? (
                <p className="py-3 text-sm text-muted-foreground">No items in this category.</p>
              ) : (
                items.map((it) => {
                  const itsVariants = data.variants.filter((v) => v.menu_item_id === it.id);
                  return (
                    <div key={it.id} className="flex items-center justify-between gap-2 py-2.5">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{it.name}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {foodMark(it.veg_type)}
                          </Badge>
                          {it.is_available === 0 && <Badge variant="secondary">Unavailable</Badge>}
                        </div>
                        <div className="text-xs tabular-nums text-muted-foreground">
                          {itsVariants.length
                            ? `${itsVariants.map((v) => `${v.name} ${inr(v.price)}`).join(" · ")}`
                            : inr(it.price)}
                        </div>
                      </div>
                      <Button size="sm" variant={it.is_available ? "outline" : "default"} onClick={() => toggle(it.id)}>
                        {it.is_available ? "Mark unavailable" : "Available"}
                      </Button>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add menu item</DialogTitle>
            <DialogDescription>Price is entered in rupees, stored as paise.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Paneer Tikka" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Category</label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {data.categories.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Price (₹)</label>
                <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="240" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Type</label>
              <Select value={veg} onValueChange={setVeg}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="veg">Veg</SelectItem>
                  <SelectItem value="non_veg">Non-veg</SelectItem>
                  <SelectItem value="egg">Egg</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit}>Add item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}