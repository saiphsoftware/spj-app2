import { pgTable, text, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const packagesTable = pgTable("packages", {
  id: text("id").primaryKey(),
  puzzleCount: integer("puzzle_count").notNull(),
  price: real("price").notNull(),
  originalPrice: real("original_price"),
  discountName: text("discount_name"),
  popular: integer("popular").notNull().default(0),
});

export const purchasesTable = pgTable("purchases", {
  id: text("id").primaryKey(),
  userSub: text("user_sub").notNull().references(() => usersTable.sub),
  packageId: text("package_id").notNull().references(() => packagesTable.id),
  price: real("price").notNull(),
  txid: text("txid").notNull(),
  status: text("status").notNull().default("success"),
  purchasedOn: integer("purchased_on").notNull(),
});

export const insertPackageSchema = createInsertSchema(packagesTable);
export type InsertPackage = z.infer<typeof insertPackageSchema>;
export type Package = typeof packagesTable.$inferSelect;

export const insertPurchaseSchema = createInsertSchema(purchasesTable);
export type InsertPurchase = z.infer<typeof insertPurchaseSchema>;
export type Purchase = typeof purchasesTable.$inferSelect;
