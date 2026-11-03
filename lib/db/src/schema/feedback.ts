import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const feedbackSubmissionsTable = pgTable("feedback_submissions", {
  id: text("id").primaryKey(),
  userSub: text("user_sub").references(() => usersTable.sub, { onDelete: "set null" }),
  category: text("category").notNull(),
  message: text("message").notNull(),
  email: text("email"),
  page: text("page"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const puzzleReportsTable = pgTable("puzzle_reports", {
  id: text("id").primaryKey(),
  puzzleId: text("puzzle_id").notNull(),
  puzzleTitle: text("puzzle_title").notNull(),
  reporterSub: text("reporter_sub").references(() => usersTable.sub, { onDelete: "set null" }),
  reason: text("reason").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
