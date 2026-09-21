import { pgTable, text, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { puzzlesTable } from "./puzzles";
import { usersTable } from "./users";

export const piecesTable = pgTable("pieces", {
  id: text("id").primaryKey(),
  puzzleId: text("puzzle_id").notNull().references(() => puzzlesTable.id),
  image: text("image").notNull(),
  position: integer("position").notNull(),
  limit: integer("limit").notNull().default(1),
  message: text("message").notNull().default(""),
});

export const pieceCollectionsTable = pgTable("piece_collections", {
  id: text("id").primaryKey(),
  pieceId: text("piece_id").notNull().references(() => piecesTable.id),
  userSub: text("user_sub").notNull().references(() => usersTable.sub),
  collectedOn: integer("collected_on").notNull(),
});

export const insertPieceSchema = createInsertSchema(piecesTable);
export type InsertPiece = z.infer<typeof insertPieceSchema>;
export type Piece = typeof piecesTable.$inferSelect;

export const insertPieceCollectionSchema = createInsertSchema(pieceCollectionsTable);
export type InsertPieceCollection = z.infer<typeof insertPieceCollectionSchema>;
export type PieceCollection = typeof pieceCollectionsTable.$inferSelect;
