# restaurant portal — HTML Prototypes

2 standalone HTML prototypes (no tech stack, no build) for the QR dine-in ordering SaaS.

- `customer.html` — Customer portal (phone): QR scan → menu → cart → orders
- `admin.html` — Restaurant portal (admin + staff): Dashboard, Live Board, Kitchen, Billing, Print 80mm, Total Orders, Menu, Tables & QR, Staff, Settings
- `index.html` — landing linking both

Open any file directly in a browser. Tailwind via CDN, works offline after first load.

Spec: `docs/SPEC.md` (if attached). Business rules: one open session per table, first-order approval, integer paise billing, FY invoicing, business day 04:00, payment recorded not collected.
