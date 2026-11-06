import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const authRateLimitsTable = pgTable(
  "auth_rate_limits",
  {
    bucket: text("bucket").primaryKey(),
    requestCount: integer("request_count").notNull(),
    resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("auth_rate_limits_reset_at_idx").on(table.resetAt)],
);
