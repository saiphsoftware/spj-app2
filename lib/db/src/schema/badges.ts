import { pgTable, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const badgesTable = pgTable("badges", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  image: text("image").notNull(),
  description: text("description"),
});

export const userBadgesTable = pgTable("user_badges", {
  id: text("id").primaryKey(),
  userSub: text("user_sub").notNull(),
  badgeId: text("badge_id").notNull().references(() => badgesTable.id),
  awardedOn: text("awarded_on").notNull(),
  puzzleId: text("puzzle_id"),
});

export const insertBadgeSchema = createInsertSchema(badgesTable);
export type InsertBadge = z.infer<typeof insertBadgeSchema>;
export type Badge = typeof badgesTable.$inferSelect;

export const insertUserBadgeSchema = createInsertSchema(userBadgesTable);
export type InsertUserBadge = z.infer<typeof insertUserBadgeSchema>;
export type UserBadge = typeof userBadgesTable.$inferSelect;
