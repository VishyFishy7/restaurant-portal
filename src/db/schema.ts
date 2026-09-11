import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

// ---------- Restaurants (tenants) ----------
export const restaurants = sqliteTable("restaurants", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  currency: text("currency").notNull().default("INR"),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  gst_mode: text("gst_mode").notNull().default("regular"), // regular | none
  gst_rate: integer("gst_rate").notNull().default(5), // percent (integer)
  service_charge_pct: integer("service_charge_pct").notNull().default(0),
  approval_required: integer("approval_required").notNull().default(0), // 0|1
  customer_cancel_window_seconds: integer("customer_cancel_window_seconds")
    .notNull()
    .default(120),
  business_day_start_hour: integer("business_day_start_hour").notNull().default(4),
  access_state: text("access_state").notNull().default("full"), // full | read_only
  created_at: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ---------- Dining tables ----------
export const diningTables = sqliteTable(
  "dining_tables",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    restaurant_id: integer("restaurant_id")
      .notNull()
      .references(() => restaurants.id),
    label: text("label").notNull(), // "Table 1"
    table_number: integer("table_number").notNull(),
    qr_token: text("qr_token").notNull(), // 16-char base62
    is_active: integer("is_active").notNull().default(1),
    created_at: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => [uniqueIndex("dining_tables_qr_token_idx").on(t.qr_token)],
);

// ---------- Menu ----------
export const menuCategories = sqliteTable("menu_categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  restaurant_id: integer("restaurant_id")
    .notNull()
    .references(() => restaurants.id),
  name: text("name").notNull(),
  sort_order: integer("sort_order").notNull().default(0),
  is_active: integer("is_active").notNull().default(1),
});

export const menuItems = sqliteTable(
  "menu_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    restaurant_id: integer("restaurant_id")
      .notNull()
      .references(() => restaurants.id),
    category_id: integer("category_id")
      .notNull()
      .references(() => menuCategories.id),
    name: text("name").notNull(),
    description: text("description"),
    price: integer("price").notNull(), // paise
    veg_type: text("veg_type").notNull().default("veg"), // veg | non_veg | egg
    is_available: integer("is_available").notNull().default(1),
    is_active: integer("is_active").notNull().default(1),
    sort_order: integer("sort_order").notNull().default(0),
  },
  (t) => [index("menu_items_category_idx").on(t.category_id)],
);

export const menuItemVariants = sqliteTable(
  "menu_item_variants",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    menu_item_id: integer("menu_item_id")
      .notNull()
      .references(() => menuItems.id),
    name: text("name").notNull(), // Half / Full
    price: integer("price").notNull(), // paise
    is_available: integer("is_available").notNull().default(1),
  },
  (t) => [index("menu_item_variants_item_idx").on(t.menu_item_id)],
);

// ---------- Sessions / Orders ----------
export const tableSessions = sqliteTable(
  "table_sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    restaurant_id: integer("restaurant_id")
      .notNull()
      .references(() => restaurants.id),
    table_id: integer("table_id")
      .notNull()
      .references(() => diningTables.id),
    status: text("status").notNull().default("open"), // open | billed
    approval_status: text("approval_status").notNull().default("pending"), // pending | approved
    opened_at: text("opened_at").notNull().default(sql`(datetime('now'))`),
    closed_at: text("closed_at"),
  },
  (t) => [index("sessions_table_idx").on(t.table_id, t.status)],
);

export const orders = sqliteTable(
  "orders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    session_id: integer("session_id")
      .notNull()
      .references(() => tableSessions.id),
    restaurant_id: integer("restaurant_id")
      .notNull()
      .references(() => restaurants.id),
    table_id: integer("table_id")
      .notNull()
      .references(() => diningTables.id),
    order_number: integer("order_number").notNull(), // 1, 2, 3... per session
    status: text("status").notNull().default("accepted"), // pending_approval | accepted | completed
    device_id: text("device_id"),
    note: text("note"),
    created_at: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => [index("orders_session_idx").on(t.session_id)],
);

export const orderItems = sqliteTable(
  "order_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    order_id: integer("order_id")
      .notNull()
      .references(() => orders.id),
    session_id: integer("session_id")
      .notNull()
      .references(() => tableSessions.id),
    menu_item_id: integer("menu_item_id").references(() => menuItems.id),
    variant_id: integer("variant_id").references(() => menuItemVariants.id),
    item_name: text("item_name").notNull(), // snapshot
    variant_name: text("variant_name"),
    unit_price: integer("unit_price").notNull(), // paise snapshot
    quantity: integer("quantity").notNull().default(1),
    status: text("status").notNull().default("placed"), // placed|preparing|ready|served|cancelled
    created_at: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => [index("order_items_session_idx").on(t.session_id), index("order_items_order_idx").on(t.order_id)],
);

// ---------- Bills ----------
export const bills = sqliteTable(
  "bills",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    session_id: integer("session_id")
      .notNull()
      .references(() => tableSessions.id),
    restaurant_id: integer("restaurant_id")
      .notNull()
      .references(() => restaurants.id),
    table_id: integer("table_id")
      .notNull()
      .references(() => diningTables.id),
    invoice_number: text("invoice_number").notNull(),
    subtotal: integer("subtotal").notNull(), // paise
    gst: integer("gst").notNull().default(0), // paise
    service_charge: integer("service_charge").notNull().default(0), // paise
    round_off: integer("round_off").notNull().default(0), // paise (-50..+50)
    total: integer("total").notNull(), // paise
    payment_mode: text("payment_mode"), // cash | upi | card
    payment_status: text("payment_status").notNull().default("unpaid"), // unpaid | paid
    generated_at: text("generated_at").notNull().default(sql`(datetime('now'))`),
    paid_at: text("paid_at"),
  },
  (t) => [uniqueIndex("bills_invoice_idx").on(t.restaurant_id, t.invoice_number)],
);

export type Restaurant = typeof restaurants.$inferSelect;
export type DiningTable = typeof diningTables.$inferSelect;
export type MenuCategory = typeof menuCategories.$inferSelect;
export type MenuItem = typeof menuItems.$inferSelect;
export type MenuItemVariant = typeof menuItemVariants.$inferSelect;
export type TableSession = typeof tableSessions.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Bill = typeof bills.$inferSelect;