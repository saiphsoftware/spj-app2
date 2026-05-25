import { pgTable, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  sub: text("sub").primaryKey(),
  name: text("name").notNull(),
  avatar: text("avatar").notNull(),
  type: text("type").notNull().default("site"),
  passwordHash: text("password_hash"),
  email: text("email").notNull().unique(),
  remainingPuzzles: integer("remaining_puzzles").notNull().default(3),
  created: integer("created").notNull(),
});

export const activityTable = pgTable("activity", {
  id: text("id").primaryKey(),
  userSub: text("user_sub").notNull().references(() => usersTable.sub),
  type: text("type").notNull(),
  on: integer("on").notNull(),
  details: text("details").notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ created: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

export const insertActivitySchema = createInsertSchema(activityTable);
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activityTable.$inferSelect;
