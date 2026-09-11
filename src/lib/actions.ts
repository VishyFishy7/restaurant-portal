"use server";

import { eq, and, asc, desc, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { nextInvoiceNumber, todayKolkata } from "@/lib/money";
import type { SessionPayload } from "@/lib/queries";
import { dashboardStats, getOpenSessionsSummary } from "@/lib/queries";

export type ActionResult = { ok: boolean; error?: string; data?: Record<string, unknown> };

export type CartLine = { menuItemId: number; variantId: number | null; qty: number };

// ---------------- Customer ----------------
export async function placeOrder(
  qrToken: string,
  deviceId: string,
  lines: CartLine[],
  note?: string,
): Promise<ActionResult> {
  try {
    const table = await db.select().from(schema.diningTables).where(eq(schema.diningTables.qr_token, qrToken)).get();
    if (!table) return { ok: false, error: "Table not found — scan a valid QR code." };
    const restaurant = await db.select().from(schema.restaurants).where(eq(schema.restaurants.id, table.restaurant_id)).get();
    if (!restaurant) return { ok: false, error: "Restaurant unavailable." };
    if (restaurant.access_state !== "full")
      return { ok: false, error: "This restaurant is currently not accepting orders." };
    if (!lines.length) return { ok: false, error: "Your cart is empty." };
    if (lines.length > 30) return { ok: false, error: "Too many line items." };

    // Validate lines against menu (snapshot names/prices).
    const payload: Array<{
      menu_item_id: number;
      variant_id: number | null;
      item_name: string;
      variant_name: string | null;
      unit_price: number;
      quantity: number;
    }> = [];
    for (const line of lines) {
      const item = await db.select().from(schema.menuItems).where(eq(schema.menuItems.id, line.menuItemId)).get();
      if (!item) return { ok: false, error: "An item in your cart is no longer available." };
      if (!item.is_available) return { ok: false, error: `"${item.name}" is currently unavailable.` };
      let unitPrice = item.price;
      let variantName: string | null = null;
      let variantId: number | null = null;
      if (line.variantId) {
        const v = await db.select().from(schema.menuItemVariants).where(eq(schema.menuItemVariants.id, line.variantId)).get();
        if (!v) return { ok: false, error: "Invalid variant." };
        variantId = v.id;
        variantName = v.name;
        unitPrice = v.price;
      }
      if (line.qty < 1 || line.qty > 20) return { ok: false, error: `Quantity for ${item.name} must be 1–20.` };
      payload.push({
        menu_item_id: item.id,
        variant_id: variantId,
        item_name: item.name,
        variant_name: variantName,
        unit_price: unitPrice,
        quantity: line.qty,
      });
    }

    // Open-or-reuse a single open session per table.
    let session = await db
      .select()
      .from(schema.tableSessions)
      .where(and(eq(schema.tableSessions.table_id, table.id), eq(schema.tableSessions.status, "open")))
      .get();
    if (!session) {
      const needsApproval = restaurant.approval_required === 1;
      session = await db
        .insert(schema.tableSessions)
        .values({
          restaurant_id: restaurant.id,
          table_id: table.id,
          status: "open",
          approval_status: needsApproval ? "pending" : "approved",
        })
        .returning()
        .get();
    }
    const approvalRequired = restaurant.approval_required === 1 && session.approval_status !== "approved";
    const orderStatus = approvalRequired ? "pending_approval" : "accepted";

    const count =
      (
        await db
          .select({ c: sql<number>`count(*)` })
          .from(schema.orders)
          .where(eq(schema.orders.session_id, session.id))
          .get()
      )?.c ?? 0;

    const order = await db
      .insert(schema.orders)
      .values({
        session_id: session.id,
        restaurant_id: restaurant.id,
        table_id: table.id,
        order_number: count + 1,
        status: orderStatus,
        device_id: deviceId,
        note: note || null,
      })
      .returning()
      .get();

    for (const p of payload) {
      await db
        .insert(schema.orderItems)
        .values({
          order_id: order.id,
          session_id: session.id,
          menu_item_id: p.menu_item_id,
          variant_id: p.variant_id,
          item_name: p.item_name,
          variant_name: p.variant_name,
          unit_price: p.unit_price,
          quantity: p.quantity,
          status: "placed",
        })
        .run();
    }

    return { ok: true, data: { orderId: order.id, pendingApproval: approvalRequired } };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function cancelItem(qrToken: string, deviceId: string, itemId: number): Promise<ActionResult> {
  const item = await db.select().from(schema.orderItems).where(eq(schema.orderItems.id, itemId)).get();
  if (!item) return { ok: false, error: "Item not found." };
  const order = await db.select().from(schema.orders).where(eq(schema.orders.id, item.order_id)).get();
  if (!order) return { ok: false, error: "Order not found." };
  if (order.device_id !== deviceId) return { ok: false, error: "You can only cancel your own items." };
  const table = await db.select().from(schema.diningTables).where(eq(schema.diningTables.id, order.table_id)).get();
  const restaurant = await db.select().from(schema.restaurants).where(eq(schema.restaurants.id, table?.restaurant_id ?? 0)).get();
  if (table?.qr_token !== qrToken) return { ok: false, error: "Table mismatch." };
  if (item.status !== "placed") return { ok: false, error: "This item is already being prepared — cannot cancel." };
  const windowSec = restaurant?.customer_cancel_window_seconds ?? 120;
  const created = new Date(order.created_at + "Z").getTime();
  const now = Date.now();
  if (now - created > windowSec * 1000) return { ok: false, error: "Cancellation window (2 min) has passed." };
  await db.update(schema.orderItems).set({ status: "cancelled" }).where(eq(schema.orderItems.id, itemId)).run();
  return { ok: true };
}

// ---------------- Staff / kitchen ----------------
export async function updateItemStatus(itemId: number, status: string): Promise<ActionResult> {
  const valid = ["preparing", "ready", "served", "placed"];
  if (!valid.includes(status)) return { ok: false, error: "Invalid status." };
  const item = await db.select().from(schema.orderItems).where(eq(schema.orderItems.id, itemId)).get();
  if (!item) return { ok: false, error: "Item not found." };
  await db.update(schema.orderItems).set({ status }).where(eq(schema.orderItems.id, itemId)).run();
  // If every non-cancelled item in the order is served, complete the order.
  const orderItems = await db
    .select()
    .from(schema.orderItems)
    .where(and(eq(schema.orderItems.order_id, item.order_id), sql`${schema.orderItems.status} != 'cancelled'`))
    .all();
  if (orderItems.length > 0 && orderItems.every((i) => i.status === "served")) {
    await db.update(schema.orders).set({ status: "completed" }).where(eq(schema.orders.id, item.order_id)).run();
  }
  return { ok: true };
}

export async function approveOrder(orderId: number): Promise<ActionResult> {
  const order = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).get();
  if (!order) return { ok: false, error: "Order not found." };
  const session = await db.select().from(schema.tableSessions).where(eq(schema.tableSessions.id, order.session_id)).get();
  if (session) {
    await db.update(schema.tableSessions).set({ approval_status: "approved" }).where(eq(schema.tableSessions.id, session.id)).run();
  }
  await db.update(schema.orders).set({ status: "accepted" }).where(eq(schema.orders.id, orderId)).run();
  return { ok: true };
}

export async function approvePendingOrders(orderIds: number[]): Promise<ActionResult> {
  for (const id of orderIds) await approveOrder(id);
  return { ok: true };
}

// ---------------- Billing ----------------
export async function generateBill(sessionId: number): Promise<ActionResult> {
  const session = await db
    .select()
    .from(schema.tableSessions)
    .where(and(eq(schema.tableSessions.id, sessionId), eq(schema.tableSessions.status, "open")))
    .get();
  if (!session) return { ok: false, error: "Session not open." };
  const restaurant = await db.select().from(schema.restaurants).where(eq(schema.restaurants.id, session.restaurant_id)).get();
  const items = await db
    .select()
    .from(schema.orderItems)
    .where(and(eq(schema.orderItems.session_id, session.id), sql`${schema.orderItems.status} != 'cancelled'`))
    .all();
  if (!items.length) return { ok: false, error: "No billable items." };
  const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const gstPct = restaurant?.gst_mode === "regular" ? (restaurant?.gst_rate ?? 5) : 0;
  const scPct = restaurant?.service_charge_pct ?? 0;
  const gst = Math.round((subtotal * gstPct) / 100);
  const service = Math.round((subtotal * scPct) / 100);
  const preTotal = subtotal + gst + service;
  const total = Math.round(preTotal / 5) * 5;
  const roundOff = total - preTotal;

  const dateStr = todayKolkata();
  const seq = ((await db.select({ c: sql<number>`count(*)` }).from(schema.bills).where(sql`${schema.bills.invoice_number} LIKE ${`${dateStr.replace(/-/g, "")}-%`}`).get())?.c ?? 0) + 1;
  const invoiceNumber = nextInvoiceNumber(dateStr, seq);

  const bill = await db
    .insert(schema.bills)
    .values({
      session_id: session.id,
      restaurant_id: session.restaurant_id,
      table_id: session.table_id,
      invoice_number: invoiceNumber,
      subtotal,
      gst,
      service_charge: service,
      round_off: roundOff,
      total,
      payment_status: "unpaid",
    })
    .returning()
    .get();

  await db.update(schema.tableSessions).set({ status: "billed", closed_at: new Date().toISOString() }).where(eq(schema.tableSessions.id, session.id)).run();
  await db.update(schema.orders).set({ status: "completed" }).where(eq(schema.orders.session_id, session.id)).run();

  return { ok: true, data: { billId: bill.id, total: bill.total, invoice: bill.invoice_number } };
}

export async function setBillPayment(billId: number, mode: string, paid: boolean): Promise<ActionResult> {
  if (!["cash", "upi", "card"].includes(mode)) return { ok: false, error: "Invalid mode." };
  await db
    .update(schema.bills)
    .set({ payment_mode: mode, payment_status: paid ? "paid" : "unpaid", paid_at: paid ? new Date().toISOString() : null })
    .where(eq(schema.bills.id, billId))
    .run();
  return { ok: true };
}

// ---------------- Admin: menu / tables / settings ----------------
export async function toggleItemAvailability(itemId: number): Promise<ActionResult> {
  const item = await db.select().from(schema.menuItems).where(eq(schema.menuItems.id, itemId)).get();
  if (!item) return { ok: false, error: "Item not found." };
  await db.update(schema.menuItems).set({ is_available: item.is_available ? 0 : 1 }).where(eq(schema.menuItems.id, itemId)).run();
  return { ok: true };
}

export async function updateSettings(patch: { gst_rate?: number; service_charge_pct?: number; approval_required?: boolean; customer_cancel_window_seconds?: number }): Promise<ActionResult> {
  const restaurant = await db.select().from(schema.restaurants).limit(1).get();
  if (!restaurant) return { ok: false, error: "No restaurant." };
  await db
    .update(schema.restaurants)
    .set({
      ...(patch.gst_rate !== undefined ? { gst_rate: patch.gst_rate } : {}),
      ...(patch.service_charge_pct !== undefined ? { service_charge_pct: patch.service_charge_pct } : {}),
      ...(patch.approval_required !== undefined ? { approval_required: patch.approval_required ? 1 : 0 } : {}),
      ...(patch.customer_cancel_window_seconds !== undefined ? { customer_cancel_window_seconds: patch.customer_cancel_window_seconds } : {}),
    })
    .where(eq(schema.restaurants.id, restaurant.id))
    .run();
  return { ok: true };
}
// Customer polling: returns the open session with per-item cancellation
// deadlines computed only for the calling device's own placed items.
export async function pollSession(qrToken: string, deviceId: string): Promise<SessionPayload> {
  const table = await db.select().from(schema.diningTables).where(eq(schema.diningTables.qr_token, qrToken)).get();
  if (!table) return { session: null, orders: [] };
  const restaurant = await db.select().from(schema.restaurants).where(eq(schema.restaurants.id, table.restaurant_id)).get();
  const windowSec = restaurant?.customer_cancel_window_seconds ?? 120;
  const session = await db
    .select()
    .from(schema.tableSessions)
    .where(and(eq(schema.tableSessions.table_id, table.id), eq(schema.tableSessions.status, "open")))
    .get();
  if (!session) return { session: null, orders: [] };
  const orders = await db.select().from(schema.orders).where(eq(schema.orders.session_id, session.id)).orderBy(asc(schema.orders.order_number)).all();
  const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.session_id, session.id)).orderBy(asc(schema.orderItems.id)).all();
  return {
    session: { id: session.id, status: session.status, approval_status: session.approval_status },
    orders: orders.map((o) => ({
      id: o.id,
      order_number: o.order_number,
      status: o.status,
      note: o.note,
      created_at: o.created_at,
      device_id: o.device_id,
      items: items
        .filter((i) => i.order_id === o.id)
        .map((it) => {
          const isMine = o.device_id === deviceId;
          let cancel_deadline: number | null = null;
          if (isMine && it.status === "placed") {
            const created = new Date(it.created_at.replace(" ", "T") + "Z").getTime();
            cancel_deadline = created + windowSec * 1000;
          }
          return {
            id: it.id,
            item_name: it.item_name,
            variant_name: it.variant_name,
            unit_price: it.unit_price,
            quantity: it.quantity,
            status: it.status,
            created_at: it.created_at,
            cancel_deadline,
          };
        }),
    })),
  };
}

// Live polling for the dashboard.
export async function getStats() {
  return dashboardStats();
}
export async function getOpenSessions() {
  return getOpenSessionsSummary();
}

export async function getLive() {
  const { getLiveBoard } = await import("@/lib/queries");
  return getLiveBoard();
}

export async function getBillingData() {
  const { getBillableSessions, getClosedBills } = await import("@/lib/queries");
  const open = (await getBillableSessions()).map((b) => ({ ...b }));
  const closed = (await getClosedBills()).map((b) => ({
    id: b.id,
    invoice_number: b.invoice_number,
    table_label: b.table_label,
    subtotal: b.subtotal,
    gst: b.gst,
    service_charge: b.service_charge,
    round_off: b.round_off,
    total: b.total,
    payment_status: b.payment_status,
    payment_mode: b.payment_mode,
    generated_at: b.generated_at,
  }));
  const restaurant = await db.select().from(schema.restaurants).limit(1).get();
  return { open, closed, gst_rate: restaurant?.gst_rate ?? 5, service_charge_pct: restaurant?.service_charge_pct ?? 0 };
}

export async function getMenuAdmin() {
  const restaurant = await db.select().from(schema.restaurants).limit(1).get();
  if (!restaurant) return null;
  const categories = await db.select().from(schema.menuCategories).orderBy(asc(schema.menuCategories.sort_order)).all();
  const items = await db.select().from(schema.menuItems).orderBy(asc(schema.menuItems.sort_order)).all();
  const variants = await db.select().from(schema.menuItemVariants).all();
  return { restaurant, categories, items, variants };
}

export async function getTablesList() {
  const tables = await db.select().from(schema.diningTables).orderBy(asc(schema.diningTables.table_number)).all();
  const restaurant = await db.select().from(schema.restaurants).limit(1).get();
  return { tables, restaurant };
}

export async function getSettings() {
  const r = await db.select().from(schema.restaurants).limit(1).get();
  return r
    ? {
        gst_rate: r.gst_rate,
        service_charge_pct: r.service_charge_pct,
        approval_required: r.approval_required === 1,
        customer_cancel_window_seconds: r.customer_cancel_window_seconds,
        access_state: r.access_state,
      }
    : null;
}

export async function createItem(input: { name: string; categoryId: number; pricePaise: number; veg_type: string; is_available?: boolean }): Promise<ActionResult> {
  try {
    const restaurant = await db.select().from(schema.restaurants).limit(1).get();
    if (!restaurant) return { ok: false, error: "No restaurant." };
    if (!input.name.trim()) return { ok: false, error: "Name required." };
    await db
      .insert(schema.menuItems)
      .values({
        restaurant_id: restaurant.id,
        category_id: input.categoryId,
        name: input.name.trim(),
        price: input.pricePaise,
        veg_type: input.veg_type,
        is_available: input.is_available !== false ? 1 : 0,
      })
      .run();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function regenerateQrToken(tableId: number): Promise<ActionResult> {
  const charset = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let token = "";
  for (let i = 0; i < 16; i++) token += charset[bytes[i] % 62];
  await db.update(schema.diningTables).set({ qr_token: token }).where(eq(schema.diningTables.id, tableId)).run();
  return { ok: true, data: { token } };
}

export async function getTotalOrders() {
  const sessions = await db.select().from(schema.tableSessions).where(eq(schema.tableSessions.status, "billed")).orderBy(desc(schema.tableSessions.closed_at)).all();
  const bills = await db.select().from(schema.bills).all();
  const out: Array<{
    session_id: number;
    table_label: string;
    closed_at: string | null;
    rounds: number;
    item_count: number;
    bill_total: number | null;
    invoice: string | null;
  }> = [];
  for (const s of sessions) {
    const table = await db.select().from(schema.diningTables).where(eq(schema.diningTables.id, s.table_id)).get();
    const orders = await db.select().from(schema.orders).where(eq(schema.orders.session_id, s.id)).all();
    const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.session_id, s.id)).all();
    const bill = bills.find((b) => b.session_id === s.id);
    out.push({
      session_id: s.id,
      table_label: table?.label ?? `#${s.table_id}`,
      closed_at: s.closed_at,
      rounds: orders.length,
      item_count: items.filter((i) => i.status !== "cancelled").length,
      bill_total: bill?.total ?? null,
      invoice: bill?.invoice_number ?? null,
    });
  }
  return out;
}