CREATE TABLE `bills` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`restaurant_id` integer NOT NULL,
	`table_id` integer NOT NULL,
	`invoice_number` text NOT NULL,
	`subtotal` integer NOT NULL,
	`gst` integer DEFAULT 0 NOT NULL,
	`service_charge` integer DEFAULT 0 NOT NULL,
	`round_off` integer DEFAULT 0 NOT NULL,
	`total` integer NOT NULL,
	`payment_mode` text,
	`payment_status` text DEFAULT 'unpaid' NOT NULL,
	`generated_at` text DEFAULT (datetime('now')) NOT NULL,
	`paid_at` text,
	FOREIGN KEY (`session_id`) REFERENCES `table_sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`table_id`) REFERENCES `dining_tables`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bills_invoice_idx` ON `bills` (`restaurant_id`,`invoice_number`);--> statement-breakpoint
CREATE TABLE `dining_tables` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` integer NOT NULL,
	`label` text NOT NULL,
	`table_number` integer NOT NULL,
	`qr_token` text NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dining_tables_qr_token_idx` ON `dining_tables` (`qr_token`);--> statement-breakpoint
CREATE TABLE `menu_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` integer NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `menu_item_variants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`menu_item_id` integer NOT NULL,
	`name` text NOT NULL,
	`price` integer NOT NULL,
	`is_available` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `menu_item_variants_item_idx` ON `menu_item_variants` (`menu_item_id`);--> statement-breakpoint
CREATE TABLE `menu_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` integer NOT NULL,
	`category_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`price` integer NOT NULL,
	`veg_type` text DEFAULT 'veg' NOT NULL,
	`is_available` integer DEFAULT 1 NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `menu_categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `menu_items_category_idx` ON `menu_items` (`category_id`);--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`session_id` integer NOT NULL,
	`menu_item_id` integer,
	`variant_id` integer,
	`item_name` text NOT NULL,
	`variant_name` text,
	`unit_price` integer NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'placed' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`session_id`) REFERENCES `table_sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`variant_id`) REFERENCES `menu_item_variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `order_items_session_idx` ON `order_items` (`session_id`);--> statement-breakpoint
CREATE INDEX `order_items_order_idx` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`restaurant_id` integer NOT NULL,
	`table_id` integer NOT NULL,
	`order_number` integer NOT NULL,
	`status` text DEFAULT 'accepted' NOT NULL,
	`device_id` text,
	`note` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `table_sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`table_id`) REFERENCES `dining_tables`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `orders_session_idx` ON `orders` (`session_id`);--> statement-breakpoint
CREATE TABLE `restaurants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`currency` text DEFAULT 'INR' NOT NULL,
	`timezone` text DEFAULT 'Asia/Kolkata' NOT NULL,
	`gst_mode` text DEFAULT 'regular' NOT NULL,
	`gst_rate` integer DEFAULT 5 NOT NULL,
	`service_charge_pct` integer DEFAULT 0 NOT NULL,
	`approval_required` integer DEFAULT 0 NOT NULL,
	`customer_cancel_window_seconds` integer DEFAULT 120 NOT NULL,
	`business_day_start_hour` integer DEFAULT 4 NOT NULL,
	`access_state` text DEFAULT 'full' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `restaurants_slug_unique` ON `restaurants` (`slug`);--> statement-breakpoint
CREATE TABLE `table_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`restaurant_id` integer NOT NULL,
	`table_id` integer NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`approval_status` text DEFAULT 'pending' NOT NULL,
	`opened_at` text DEFAULT (datetime('now')) NOT NULL,
	`closed_at` text,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`table_id`) REFERENCES `dining_tables`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sessions_table_idx` ON `table_sessions` (`table_id`,`status`);