import { Router } from "express";
import { db, piecesTable, pieceCollectionsTable, puzzlesTable, usersTable, activityTable, userBadgesTable, badgesTable, puzzleParticipantsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

const router = Router();

function getSub(req: any): string | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    return Buffer.from(auth.slice(7), "base64").toString().split(":")[0];
  } catch { return null; }
}

router.get("/pieces/:id", async (req, res): Promise<void> => {
  const pieces = await db.select().from(piecesTable).where(eq(piecesTable.id, req.params.id)).limit(1);
  if (pieces.length === 0) { res.status(404).json({ error: "Not found" }); return; }
  const p = pieces[0];

  const collections = await db.select().from(pieceCollectionsTable).where(eq(pieceCollectionsTable.pieceId, p.id));
  const collected = await Promise.all(collections.map(async c => {
    const u = await db.select().from(usersTable).where(eq(usersTable.sub, c.userSub)).limit(1);
    return { by: { sub: c.userSub, name: u[0]?.name ?? "Unknown", avatar: u[0]?.avatar ?? "" }, on: c.collectedOn };
  }));

  res.json({ ...p, shareUrl: `/play/piece/${p.id}`, collected });
});

router.post("/pieces/:id/collect", async (req, res): Promise<void> => {
  const sub = getSub(req);
  if (!sub) { res.status(401).json({ error: "Unauthorized" }); return; }

  const pieces = await db.select().from(piecesTable).where(eq(piecesTable.id, req.params.id)).limit(1);
  if (pieces.length === 0) { res.status(404).json({ error: "Not found" }); return; }
  const piece = pieces[0];

  // Check existing collections
  const existing = await db.select().from(pieceCollectionsTable).where(eq(pieceCollectionsTable.pieceId, piece.id));
  const alreadyCollected = existing.some(c => c.userSub === sub);

  if (alreadyCollected) { res.status(409).json({ error: "Already collected" }); return; }
  if (existing.length >= piece.limit) { res.status(409).json({ error: "Piece limit reached" }); return; }

  const now = Math.floor(Date.now() / 1000);
  await db.insert(pieceCollectionsTable).values({
    id: crypto.randomUUID(),
    pieceId: piece.id,
    userSub: sub,
    collectedOn: now,
  });

  await db.insert(activityTable).values({
    id: crypto.randomUUID(),
    userSub: sub,
    type: "collected_piece",
    on: now,
    details: `Collected puzzle piece #${piece.position + 1}`,
  });

  // Check if user has completed the puzzle
  const allPieces = await db.select().from(piecesTable).where(eq(piecesTable.puzzleId, piece.puzzleId));
  const allCollections = await db.select().from(pieceCollectionsTable);
  const userHasAll = allPieces.every(p => allCollections.some(c => c.pieceId === p.id && c.userSub === sub));

  let badgeAwarded = null;
  let puzzleCompleted = false;

  if (userHasAll) {
    puzzleCompleted = true;

    // Upsert participant as completed
    const existing = await db.select().from(puzzleParticipantsTable)
      .where(and(eq(puzzleParticipantsTable.puzzleId, piece.puzzleId), eq(puzzleParticipantsTable.userSub, sub)))
      .limit(1);

    if (existing.length > 0) {
      await db.update(puzzleParticipantsTable).set({ completed: 1 }).where(eq(puzzleParticipantsTable.id, existing[0].id));
    } else {
      await db.insert(puzzleParticipantsTable).values({
        id: crypto.randomUUID(),
        puzzleId: piece.puzzleId,
        userSub: sub,
        completed: 1,
        joinedOn: now,
      });
    }

    // Increment completion count
    const puzzleData = await db.select().from(puzzlesTable).where(eq(puzzlesTable.id, piece.puzzleId)).limit(1);
    if (puzzleData.length > 0) {
      await db.update(puzzlesTable).set({ completionCount: puzzleData[0].completionCount + 1 }).where(eq(puzzlesTable.id, piece.puzzleId));

      // Award completion badge
      if (puzzleData[0].completionBadgeId) {
        const badge = await db.select().from(badgesTable).where(eq(badgesTable.id, puzzleData[0].completionBadgeId)).limit(1);
        if (badge.length > 0) {
          await db.insert(userBadgesTable).values({
            id: crypto.randomUUID(),
            userSub: sub,
            badgeId: badge[0].id,
            awardedOn: String(now),
            puzzleId: piece.puzzleId,
          });
          badgeAwarded = badge[0];
        }
      }

      await db.insert(activityTable).values({
        id: crypto.randomUUID(),
        userSub: sub,
        type: "completed_puzzle",
        on: now,
        details: `Completed a puzzle`,
      });
    }
  } else {
    // Track participation
    const existingParticipant = await db.select().from(puzzleParticipantsTable)
      .where(and(eq(puzzleParticipantsTable.puzzleId, piece.puzzleId), eq(puzzleParticipantsTable.userSub, sub)))
      .limit(1);
    if (existingParticipant.length === 0) {
      await db.insert(puzzleParticipantsTable).values({
        id: crypto.randomUUID(),
        puzzleId: piece.puzzleId,
        userSub: sub,
        completed: 0,
        joinedOn: now,
      });
    }
  }

  const updatedCollections = await db.select().from(pieceCollectionsTable).where(eq(pieceCollectionsTable.pieceId, piece.id));
  const collected = await Promise.all(updatedCollections.map(async c => {
    const u = await db.select().from(usersTable).where(eq(usersTable.sub, c.userSub)).limit(1);
    return { by: { sub: c.userSub, name: u[0]?.name ?? "Unknown", avatar: u[0]?.avatar ?? "" }, on: c.collectedOn };
  }));

  res.json({
    success: true,
    piece: { ...piece, shareUrl: `/play/piece/${piece.id}`, collected },
    badgeAwarded,
    puzzleCompleted,
  });
});

export default router;
