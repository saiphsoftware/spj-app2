import { Router } from "express";
import { db, usersTable, activityTable, pieceCollectionsTable, piecesTable, userBadgesTable, badgesTable, puzzlesTable, puzzleParticipantsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

function getSub(req: any): string | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    return Buffer.from(auth.slice(7), "base64").toString().split(":")[0];
  } catch { return null; }
}

router.get("/users/me/stats", async (req, res): Promise<void> => {
  const sub = getSub(req);
  if (!sub) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await db.select().from(usersTable).where(eq(usersTable.sub, sub)).limit(1);
  if (user.length === 0) { res.status(404).json({ error: "Not found" }); return; }

  const piecesCollected = await db.select().from(pieceCollectionsTable).where(eq(pieceCollectionsTable.userSub, sub));
  const badgesEarned = await db.select().from(userBadgesTable).where(eq(userBadgesTable.userSub, sub));
  const puzzlesCreated = await db.select().from(puzzlesTable).where(eq(puzzlesTable.creatorSub, sub));
  const completed = await db.select().from(puzzleParticipantsTable).where(and(eq(puzzleParticipantsTable.userSub, sub), eq(puzzleParticipantsTable.completed, 1)));

  res.json({
    piecesCollected: piecesCollected.length,
    badgesEarned: badgesEarned.length,
    puzzlesCreated: puzzlesCreated.length,
    puzzlesCompleted: completed.length,
    remainingPuzzles: user[0].remainingPuzzles,
  });
});

router.get("/users/me/pieces", async (req, res): Promise<void> => {
  const sub = getSub(req);
  if (!sub) { res.status(401).json({ error: "Unauthorized" }); return; }

  const collections = await db.select().from(pieceCollectionsTable).where(eq(pieceCollectionsTable.userSub, sub));
  const pieces = await Promise.all(collections.map(async c => {
    const p = await db.select().from(piecesTable).where(eq(piecesTable.id, c.pieceId)).limit(1);
    if (p.length === 0) return null;
    return { ...p[0], shareUrl: `/play/piece/${p[0].id}`, collected: [{ by: { sub }, on: c.collectedOn }] };
  }));

  res.json(pieces.filter(Boolean));
});

router.get("/users/me/badges", async (req, res): Promise<void> => {
  const sub = getSub(req);
  if (!sub) { res.status(401).json({ error: "Unauthorized" }); return; }

  const userBadges = await db.select().from(userBadgesTable).where(eq(userBadgesTable.userSub, sub));
  const badges = await Promise.all(userBadges.map(async ub => {
    const b = await db.select().from(badgesTable).where(eq(badgesTable.id, ub.badgeId)).limit(1);
    return b[0] ?? null;
  }));

  res.json(badges.filter(Boolean));
});

router.get("/users/me/puzzles", async (req, res): Promise<void> => {
  const sub = getSub(req);
  if (!sub) { res.status(401).json({ error: "Unauthorized" }); return; }

  const allPuzzles = await db.select().from(puzzlesTable).where(eq(puzzlesTable.creatorSub, sub));
  const active = allPuzzles.filter(p => p.status === "open" || p.status === "pending");
  const closed = allPuzzles.filter(p => p.status === "closed");

  const mapPuzzle = (p: any) => ({
    id: p.id, image: p.image, message: p.message, type: p.type, status: p.status,
    closeType: p.closeType, completionBadge: null, participationBadge: null, pieces: [],
    createdBy: { sub: p.creatorSub, name: "", avatar: "" },
    createdOn: p.createdOn, timeLimit: p.timeLimit, closedOn: p.closedOn,
    completionCount: p.completionCount, cut: { type: p.cutType, count: p.cutCount },
  });

  res.json({ active: active.map(mapPuzzle), closed: closed.map(mapPuzzle) });
});

router.get("/users/:uid", async (req, res): Promise<void> => {
  const { uid } = req.params;
  const users = await db.select().from(usersTable).where(eq(usersTable.sub, uid)).limit(1);
  if (users.length === 0) { res.status(404).json({ error: "Not found" }); return; }

  const user = users[0];
  const piecesCollected = await db.select().from(pieceCollectionsTable).where(eq(pieceCollectionsTable.userSub, uid));
  const badgesEarned = await db.select().from(userBadgesTable).where(eq(userBadgesTable.userSub, uid));
  const allPuzzles = await db.select().from(puzzlesTable).where(eq(puzzlesTable.creatorSub, uid));
  const active = allPuzzles.filter(p => p.status === "open" || p.status === "pending");
  const closed = allPuzzles.filter(p => p.status === "closed");

  const userBadgeRows = await db.select().from(userBadgesTable).where(eq(userBadgesTable.userSub, uid));
  const badges = await Promise.all(userBadgeRows.map(async ub => {
    const b = await db.select().from(badgesTable).where(eq(badgesTable.id, ub.badgeId)).limit(1);
    return b[0] ?? null;
  }));

  res.json({
    sub: user.sub, name: user.name, avatar: user.avatar, created: user.created,
    piecesCount: piecesCollected.length,
    badgesCount: badgesEarned.length,
    activePuzzlesCount: active.length,
    closedPuzzlesCount: closed.length,
    badges: badges.filter(Boolean),
  });
});

router.get("/users/:uid/activity", async (req, res): Promise<void> => {
  const { uid } = req.params;
  const activities = await db.select().from(activityTable)
    .where(eq(activityTable.userSub, uid))
    .limit(20);
  res.json(activities.map(a => ({ type: a.type, on: a.on, details: a.details })));
});

export default router;
