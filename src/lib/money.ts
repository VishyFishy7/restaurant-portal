// Money is integer paise everywhere. Format only at display time.
export function inr(paise: number): string {
  const rupees = paise / 100;
  const hasPaise = paise % 100 !== 0;
  return (
    "₹" +
    rupees.toLocaleString("en-IN", {
      maximumFractionDigits: hasPaise ? 2 : 0,
      minimumFractionDigits: hasPaise ? 2 : 0,
    })
  );
}

export function roundTo5(paise: number): number {
  return Math.round(paise / 500) * 500;
}

// InvoiceNumber: <yyyymmdd>-<seq 3-digit> e.g. 20260911-001
export function nextInvoiceNumber(dateStr: string, seq: number): string {
  return `${dateStr.replace(/-/g, "")}-${String(seq).padStart(3, "0")}`;
}

export function todayKolkata(): string {
  // Business-day start handling is intentionally simplified for the local mock:
  // use the server's current date as the invoice-date string.
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type ItemStatus = "placed" | "preparing" | "ready" | "served" | "cancelled";
export type OrderStatus = "pending_approval" | "accepted" | "completed";

export const ITEM_STATUSES: ItemStatus[] = ["placed", "preparing", "ready", "served", "cancelled"];