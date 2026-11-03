import { Router } from "express";
import { db, feedbackSubmissionsTable, puzzleReportsTable, puzzlesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "node:crypto";
import { ReportPuzzleBody, SubmitFeedbackBody } from "@workspace/api-zod";
import type { SubmissionReceipt } from "@workspace/api-zod";
import { getAuthenticatedSub } from "../lib/auth";

const router = Router();

router.post("/feedback", async (req, res): Promise<void> => {
  const parsed = SubmitFeedbackBody.safeParse(req.body);
  if (!parsed.success || parsed.data?.message.trim().length < 10) {
    res.status(400).json({ error: parsed.success ? "Feedback must be at least 10 characters." : parsed.error.message });
    return;
  }

  const id = crypto.randomUUID();
  const data = parsed.data;
  await db.insert(feedbackSubmissionsTable).values({
    id,
    userSub: getAuthenticatedSub(req),
    category: data.category,
    message: data.message.trim(),
    email: data.email?.trim().toLowerCase() || null,
    page: data.page?.trim() || null,
  });

  res.status(201).json({
    id,
    message: "Thanks for sharing your feedback.",
  } satisfies SubmissionReceipt);
});

router.post("/puzzles/:id/reports", async (req, res): Promise<void> => {
  const parsed = ReportPuzzleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const puzzleId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [puzzle] = await db.select({
    id: puzzlesTable.id,
    message: puzzlesTable.message,
  }).from(puzzlesTable).where(eq(puzzlesTable.id, puzzleId)).limit(1);

  if (!puzzle) {
    res.status(404).json({ error: "Puzzle not found." });
    return;
  }

  const id = crypto.randomUUID();
  await db.insert(puzzleReportsTable).values({
    id,
    puzzleId: puzzle.id,
    puzzleTitle: puzzle.message || "Untitled Puzzle",
    reporterSub: getAuthenticatedSub(req),
    reason: parsed.data.reason,
    details: parsed.data.details?.trim() || null,
  });

  res.status(201).json({
    id,
    message: "Thanks. This puzzle has been reported for review.",
  } satisfies SubmissionReceipt);
});

export default router;
