import { pgTable, text, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const puzzlesTable = pgTable("puzzles", {
  id: text("id").primaryKey(),
  image: text("image").notNull(),
  message: text("message").notNull().default(""),
  type: text("type").notNull().default("solo"),
  status: text("status").notNull().default("pending"),
  closeType: text("close_type"),
  completionBadgeId: text("completion_badge_id"),
  participationBadgeId: text("participation_badge_id"),
  creatorSub: text("creator_sub").notNull().references(() => usersTable.sub),
  createdOn: integer("created_on").notNull(),
  timeLimit: integer("time_limit"),
  closedOn: integer("closed_on"),
  completionCount: integer("completion_count").notNull().default(0),
  cutType: text("cut_type").notNull().default("rect"),
  cutCount: integer("cut_count").notNull().default(9),
});

export const puzzleParticipantsTable = pgTable("puzzle_participants", {
  id: text("id").primaryKey(),
  puzzleId: text("puzzle_id").notNull().references(() => puzzlesTable.id),
  userSub: text("user_sub").notNull().references(() => usersTable.sub),
  completed: integer("completed").notNull().default(0),
  joinedOn: integer("joined_on").notNull(),
});

export const insertPuzzleSchema = createInsertSchema(puzzlesTable);
export type InsertPuzzle = z.infer<typeof insertPuzzleSchema>;
export type Puzzle = typeof puzzlesTable.$inferSelect;

export const insertPuzzleParticipantSchema = createInsertSchema(puzzleParticipantsTable);
export type InsertPuzzleParticipant = z.infer<typeof insertPuzzleParticipantSchema>;
export type PuzzleParticipant = typeof puzzleParticipantsTable.$inferSelect;
