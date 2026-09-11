import path from "node:path";
import { randomBytes } from "node:crypto";
import { schema, db, migrateDb, isLocal, getDatabaseUrl } from "./client";

// ---- helpers ---------------------------------------------------------
const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
function qrToken(len = 16): string {
  let out = "";
  const bytes = randomBytes(len);
  for (let i = 0; i < len; i++) out += BASE62[bytes[i] % 62];
  return out;
}

const inr = (rupees: number) => Math.round(rupees * 100); // paise

const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle");

async function seed() {
  await migrateDb(MIGRATIONS_DIR);

  const existing = await db.select().from(schema.restaurants).all();
  if (existing.length > 0) {
    console.log("DB already seeded — skipping. (Table count:", (await db.select().from(schema.diningTables).all()).length, ")");
    return;
  }

  // 1. Restaurant
  const rest = await db
    .insert(schema.restaurants)
    .values({
      name: "Demo Kitchen",
      slug: "demo",
      currency: "INR",
      timezone: "Asia/Kolkata",
      gst_mode: "regular",
      gst_rate: 5,
      service_charge_pct: 10,
      approval_required: 1, // first order of a session needs staff approval
      customer_cancel_window_seconds: 120,
      access_state: "full",
    })
    .returning()
    .get();
  const rid = rest.id;

  // 2. Tables 1..6
  const tables = [];
  for (let n = 1; n <= 6; n++) {
    tables.push(
      await db
        .insert(schema.diningTables)
        .values({ restaurant_id: rid, label: `Table ${n}`, table_number: n, qr_token: qrToken() })
        .returning().get(),
    );
  }

  // 3. Categories
  const catNames = ["Starters", "Main Course", "Breads", "Beverages"];
  const cats: Record<string, number> = {};
  for (const [i, name] of catNames.entries()) {
    const c = await db
      .insert(schema.menuCategories)
      .values({ restaurant_id: rid, name, sort_order: i })
      .returning()
      .get();
    cats[name] = c.id;
  }

  // 4. Items  (name, category, price paise, vegType, available, desc)
  const items: Array<[string, string, number, string, number, string?]> = [
    ["Paneer Tikka", "Starters", inr(240), "veg", 1, "Char-grilled cottage cheese with mint chutney"],
    ["Chicken 65", "Starters", inr(260), "non_veg", 1, "Crispy fried chicken, South Indian spices"],
    ["Crispy Corn", "Starters", inr(180), "veg", 1, "Golden fried corn with bell peppers"],
    ["Dal Makhani", "Main Course", inr(220), "veg", 1, "Slow-cooked black lentils & butter (Half/Full)"],
    ["Paneer Butter Masala", "Main Course", inr(260), "veg", 1, "Cottage cheese in rich tomato gravy"],
    ["Butter Chicken", "Main Course", inr(320), "non_veg", 1, "Tandoori chicken in makhani gravy"],
    ["Veg Biryani", "Main Course", inr(200), "veg", 1, "Aromatic basmati with seasonal vegetables"],
    ["Chicken Biryani", "Main Course", inr(260), "non_veg", 1, "Hyderabadi style dum biryani"],
    ["Butter Naan", "Breads", inr(40), "veg", 1],
    ["Garlic Naan", "Breads", inr(50), "veg", 1],
    ["Tandoori Roti", "Breads", inr(25), "veg", 1],
    ["Laccha Paratha", "Breads", inr(55), "veg", 1],
    ["Masala Chai", "Beverages", inr(30), "veg", 1, "Spiced Indian tea"],
    ["Sweet Lassi", "Beverages", inr(80), "veg", 1, "Thick chilled yoghurt drink"],
    ["Fresh Lime Soda", "Beverages", inr(70), "veg", 1],
    ["Cold Coffee", "Beverages", inr(120), "veg", 0, "Frosted coffee — temporarily unavailable"],
  ];

  let dalMakhaniId = 0;
  for (const [i, [name, cat, price, veg, avail, desc]] of items.entries()) {
    const m = await db
      .insert(schema.menuItems)
      .values({
        restaurant_id: rid,
        category_id: cats[cat],
        name,
        description: desc ?? null,
        price,
        veg_type: veg,
        is_available: avail,
        sort_order: i,
      })
      .returning()
      .get();
    if (name === "Dal Makhani") dalMakhaniId = m.id;
  }

  // 5. Half/Full variant on Dal Makhani
  await db
    .insert(schema.menuItemVariants)
    .values([
      { menu_item_id: dalMakhaniId, name: "Half", price: inr(160) },
      { menu_item_id: dalMakhaniId, name: "Full", price: inr(220) },
    ])
    .run();

  console.log("✓ Seeded Demo Kitchen");
  console.log("  tables:", tables.map((t) => t.label).join(", "));
  console.log("  items:", items.length, "| categories:", catNames.length);
  console.log("  half/full on item id", dalMakhaniId, "| unavailable item: Cold Coffee");
  console.log("QR tokens:");
  for (const t of tables) console.log(`   /t/${t.qr_token}  (${t.label})`);
}

console.log(`Seeding against ${isLocal() ? `local SQLite (${getDatabaseUrl()})` : `remote libSQL (${getDatabaseUrl()})`}`);
seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    const { closeDb } = await import("./client");
    await closeDb();
  });