import "server-only";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { db, schema } from "@/db";

export type MenuPayload = {
  restaurant: {
    id: number;
    name: string;
    gst_rate: number;
    service_charge_pct: number;
    approval_required: number;
    access_state: string;
    customer_cancel_window_seconds: number;
  };
  table: { id: number; label: string; qr_token: string };
  categories: Array<{
    id: number;
    name: string;
    items: Array<{
      id: number;
      name: string;
      description: string | null;
      price: number;
      veg_type: string;
      is_available: number;
      variants: Array<{ id: number; name: string; price: number; is_available: number }>;
    }>;
  }>;
};

export async function getMenuByQrToken(qrToken: string): Promise<MenuPayload | null> {
  const table = await db
    .select()
    .from(schema.diningTables)
    .where(and(eq(schema.diningTables.qr_token, qrToken), eq(schema.diningTables.is_active, 1)))
    .get();
  if (!table) return null;
  const restaurant = await db
    .select()
    .from(schema.restaurants)
    .where(eq(schema.restaurants.id, table.restaurant_id))
    .get();
  if (!restaurant) return null;

  const categories = await db
    .select()
    .from(schema.menuCategories)
    .where(and(eq(schema.menuCategories.restaurant_id, restaurant.id), eq(schema.menuCategories.is_active, 1)))
    .orderBy(asc(schema.menuCategories.sort_order))
    .all();
  const items = await db
    .select()
    .from(schema.menuItems)
    .where(and(eq(schema.menuItems.restaurant_id, restaurant.id), eq(schema.menuItems.is_active, 1)))
    .orderBy(asc(schema.menuItems.sort_order))
    .all();
  const variants = await db.select().from(schema.menuItemVariants).all();

  return {
    restaurant: {
      id: restaurant.id,
      name: restaurant.name,
      gst_rate: restaurant.gst_rate,
      service_charge_pct: restaurant.service_charge_pct,
      approval_required: restaurant.approval_required,
      access_state: restaurant.access_state,
      customer_cancel_window_seconds: restaurant.customer_cancel_window_seconds,
    },
    table: { id: table.id, label: table.label, qr_token: table.qr_token },
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      items: items
        .filter((i) => i.category_id === c.id)
        .map((it) => ({
          id: it.id,
          name: it.name,
          description: it.description,
          price: it.price,
          veg_type: it.veg_type,
          is_available: it.is_available,
          variants: variants
            .filter((v) => v.menu_item_id === it.id)
            .map((v) => ({ id: v.id, name: v.name, price: v.price, is_available: v.is_available })),
        })),
    })),
  };
}

export type SessionItem = {
  id: number;
  item_name: string;
  variant_name: string | null;
  unit_price: number;
  quantity: number;
  status: string;
  created_at: string;
  cancel_deadline: number | null;
};
export type SessionOrder = {
  id: number;
  order_number: number;
  status: string;
  note: string | null;
  created_at: string;
  device_id: string | null;
  items: SessionItem[];
};
export type SessionPayload = {
  session: { id: number; status: string; approval_status: string } | null;
  orders: SessionOrder[];
};

export async function getSessionByQrToken(qrToken: string): Promise<SessionPayload> {
  const table = await db
    .select()
    .from(schema.diningTables)
    .where(eq(schema.diningTables.qr_token, qrToken))
    .get();
  if (!table) return { session: null, orders: [] };
  const session = await db
    .select()
    .from(schema.tableSessions)
    .where(and(eq(schema.tableSessions.table_id, table.id), eq(schema.tableSessions.status, "open")))
    .get();
  if (!session) return { session: null, orders: [] };
  const orders = await db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.session_id, session.id))
    .orderBy(asc(schema.orders.order_number))
    .all();
  const items = await db
    .select()
    .from(schema.orderItems)
    .where(eq(schema.orderItems.session_id, session.id))
    .orderBy(desc(schema.orderItems.id))
    .all();
  const result: SessionOrder[] = orders.map((o) => ({
    id: o.id,
    order_number: o.order_number,
    status: o.status,
    note: o.note,
    created_at: o.created_at,
    device_id: o.device_id,
    items: items
      .filter((i) => i.order_id === o.id)
      .map((it) => ({
        id: it.id,
        item_name: it.item_name,
        variant_name: it.variant_name,
        unit_price: it.unit_price,
        quantity: it.quantity,
        status: it.status,
        created_at: it.created_at,
        cancel_deadline: null,
      })),
  }));
  return { session, orders: result };
}

export type LiveTable = {
  table: { id: number; label: string; qr_token: string };
  session: { id: number; approval_status: string; opened_at: string } | null;
  orders: Array<{
    id: number;
    order_number: number;
    status: string;
    created_at: string;
    items: Array<{ id: number; item_name: string; variant_name: string | null; quantity: number; status: string }>;
  }>;
};

export async function getLiveBoard(): Promise<LiveTable[]> {
  const tables = await db
    .select()
    .from(schema.diningTables)
    .where(eq(schema.diningTables.is_active, 1))
    .orderBy(asc(schema.diningTables.table_number))
    .all();
  return Promise.all(
    tables.map(async (t) => {
      const session = await db
        .select()
        .from(schema.tableSessions)
        .where(and(eq(schema.tableSessions.table_id, t.id), eq(schema.tableSessions.status, "open")))
        .get();
      if (!session) return { table: { id: t.id, label: t.label, qr_token: t.qr_token }, session: null, orders: [] };
      const orders = await db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.session_id, session.id))
        .orderBy(asc(schema.orders.order_number))
        .all();
      const items = await db
        .select()
        .from(schema.orderItems)
        .where(eq(schema.orderItems.session_id, session.id))
        .orderBy(desc(schema.orderItems.id))
        .all();
      return {
        table: { id: t.id, label: t.label, qr_token: t.qr_token },
        session: { id: session.id, approval_status: session.approval_status, opened_at: session.opened_at },
        orders: orders.map((o) => ({
          id: o.id,
          order_number: o.order_number,
          status: o.status,
          created_at: o.created_at,
          items: items
            .filter((i) => i.order_id === o.id)
            .map((it) => ({ id: it.id, item_name: it.item_name, variant_name: it.variant_name, quantity: it.quantity, status: it.status })),
        })),
      };
    }),
  );
}

export type BillPreviewItem = { id: number; item_name: string; variant_name: string | null; quantity: number; amount: number };
export type BillSession = {
  session_id: number;
  table_label: string;
  opened_at: string;
  items: BillPreviewItem[];
  subtotal: number;
  gst: number;
  service_charge: number;
  round_off: number;
  total: number;
};

export async function getBillableSessions(): Promise<BillSession[]> {
  const sessions = await db
    .select()
    .from(schema.tableSessions)
    .where(eq(schema.tableSessions.status, "open"))
    .all();
  const restaurant = await db.select().from(schema.restaurants).limit(1).get();
  const result: BillSession[] = [];
  for (const s of sessions) {
    const table = await db.select().from(schema.diningTables).where(eq(schema.diningTables.id, s.table_id)).get();
    const items = await db
      .select()
      .from(schema.orderItems)
      .where(and(eq(schema.orderItems.session_id, s.id), sql`${schema.orderItems.status} != 'cancelled'`))
      .all();
    const subtotal = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
    const gstPct = restaurant?.gst_mode === "regular" ? (restaurant.gst_rate ?? 5) : 0;
    const scPct = restaurant?.service_charge_pct ?? 0;
    const gst = Math.round((subtotal * gstPct) / 100);
    const service = Math.round((subtotal * scPct) / 100);
    const preTotal = subtotal + gst + service;
    const roundedTo = Math.round(preTotal / 5) * 5;
    const roundOff = roundedTo - preTotal;
    const total = preTotal + roundOff;
    result.push({
      session_id: s.id,
      table_label: table?.label ?? `Table #${s.table_id}`,
      opened_at: s.opened_at,
      items: items.map((i) => ({ id: i.id, item_name: i.item_name, variant_name: i.variant_name, quantity: i.quantity, amount: i.unit_price * i.quantity })),
      subtotal,
      gst,
      service_charge: service,
      round_off: roundOff,
      total,
    });
  }
  return result;
}

export async function getClosedBills() {
  const bills = await db.select().from(schema.bills).orderBy(desc(schema.bills.generated_at)).all();
  return Promise.all(
    bills.map(async (b) => {
      const table = await db.select().from(schema.diningTables).where(eq(schema.diningTables.id, b.table_id)).get();
      const items = await db
        .select()
        .from(schema.orderItems)
        .where(and(eq(schema.orderItems.session_id, b.session_id), sql`${schema.orderItems.status} != 'cancelled'`))
        .all();
      return { ...b, table_label: table?.label ?? `#${b.table_id}`, items };
    }),
  );
}

export async function dashboardStats() {
  const openSessions = await db
    .select()
    .from(schema.tableSessions)
    .where(eq(schema.tableSessions.status, "open"))
    .all();
  const pendingOrders = await db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.status, "pending_approval"))
    .all();
  const activeItems = await db
    .select()
    .from(schema.orderItems)
    .where(sql`${schema.orderItems.status} IN ('placed','preparing','ready')`)
    .all();
  const todayBills = await db.select().from(schema.bills).all();
  const revenue = todayBills.reduce((s, b) => s + b.total, 0);
  const allItems = await db
    .select()
    .from(schema.orderItems)
    .where(sql`${schema.orderItems.status} != 'cancelled'`)
    .all();
  const servedCount = todayBills.length * 1 + allItems.filter((i) => i.status === "served").length;
  return {
    openTables: openSessions.length,
    pendingApprovals: pendingOrders.length,
    inProgressItems: activeItems.length,
    revenue,
    ordersToday: todayBills.length,
    itemsServed: servedCount,
  };
}

export async function getOpenSessionsSummary() {
  const sessions = await db
    .select()
    .from(schema.tableSessions)
    .where(eq(schema.tableSessions.status, "open"))
    .all();
  return Promise.all(
    sessions.map(async (s) => {
      const table = await db.select().from(schema.diningTables).where(eq(schema.diningTables.id, s.table_id)).get();
      const orderCount = (
        (await db
          .select({ c: sql<number>`count(*)` })
          .from(schema.orders)
          .where(eq(schema.orders.session_id, s.id))
          .get())?.c ?? 0
      );
      return { session_id: s.id, table_label: table?.label ?? `#${s.table_id}`, approval_status: s.approval_status, order_count: orderCount, opened_at: s.opened_at };
    }),
  );
}