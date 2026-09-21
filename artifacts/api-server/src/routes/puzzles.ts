import { Router } from "express";
import { db, puzzlesTable, piecesTable, pieceCollectionsTable, usersTable, badgesTable, puzzleParticipantsTable, activityTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import crypto from "crypto";
import {
  CreatePuzzleBody,
  UpdatePuzzleBody,
  ListPuzzlesQueryParams,
  ListTrendingPuzzlesQueryParams,
} from "@workspace/api-zod";

const router = Router();

function getSub(req: any): string | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    return Buffer.from(auth.slice(7), "base64").toString().split(":")[0];
  } catch { return null; }
}

function buildShareUrl(pieceId: string): string {
  return `/play/piece/${pieceId}`;
}

async function getPuzzleWithPieces(puzzleId: string) {
  const puzzles = await db.select().from(puzzlesTable).where(eq(puzzlesTable.id, puzzleId)).limit(1);
  if (puzzles.length === 0) return null;
  const pz = puzzles[0];

  const creator = await db.select().from(usersTable).where(eq(usersTable.sub, pz.creatorSub)).limit(1);
  const pieces = await db.select().from(piecesTable).where(eq(piecesTable.puzzleId, puzzleId));
  const allCollections = await db.select().from(pieceCollectionsTable);

  const collectionsByPiece = new Map<string, any[]>();
  for (const c of allCollections) {
    if (!collectionsByPiece.has(c.pieceId)) collectionsByPiece.set(c.pieceId, []);
    const collector = await db.select().from(usersTable).where(eq(usersTable.sub, c.userSub)).limit(1);
    collectionsByPiece.get(c.pieceId)!.push({
      by: { sub: c.userSub, name: collector[0]?.name ?? "Unknown", avatar: collector[0]?.avatar ?? "" },
      on: c.collectedOn,
    });
  }

  const completionBadge = pz.completionBadgeId
    ? (await db.select().from(badgesTable).where(eq(badgesTable.id, pz.completionBadgeId)).limit(1))[0] ?? null
    : null;
  const participationBadge = pz.participationBadgeId
    ? (await db.select().from(badgesTable).where(eq(badgesTable.id, pz.participationBadgeId)).limit(1))[0] ?? null
    : null;

  return {
    id: pz.id,
    image: pz.image,
    message: pz.message,
    type: pz.type,
    status: pz.status,
    closeType: pz.closeType,
    completionBadge,
    participationBadge,
    pieces: pieces.map(p => ({
      id: p.id,
      image: p.image,
      position: p.position,
      limit: p.limit,
       message: p.message,
      puzzleId: p.puzzleId,
      shareUrl: buildShareUrl(p.id),
      collected: collectionsByPiece.get(p.id) ?? [],
    })),
    createdBy: creator[0] ? { sub: creator[0].sub, name: creator[0].name, avatar: creator[0].avatar } : { sub: pz.creatorSub, name: "Unknown", avatar: "" },
    createdOn: pz.createdOn,
    timeLimit: pz.timeLimit,
    closedOn: pz.closedOn,
    completionCount: pz.completionCount,
    cut: { type: pz.cutType, count: pz.cutCount },
  };
}

router.get("/puzzles", async (req, res): Promise<void> => {
  const params = ListPuzzlesQueryParams.parse({
    type: req.query.type,
    status: req.query.status ?? "open",
    limit: req.query.limit ? Number(req.query.limit) : 20,
    offset: req.query.offset ? Number(req.query.offset) : 0,
  });

  let query = db.select().from(puzzlesTable);
  const conditions = [];
  if (params.type) conditions.push(eq(puzzlesTable.type, params.type));
  if (params.status) conditions.push(eq(puzzlesTable.status, params.status));

  const results = await db.select().from(puzzlesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(puzzlesTable.createdOn))
    .limit(params.limit ?? 20)
    .offset(params.offset ?? 0);

  const puzzles = await Promise.all(results.map(p => getPuzzleWithPieces(p.id)));
  res.json(puzzles.filter(Boolean));
});

router.get("/puzzles/trending", async (req, res): Promise<void> => {
  const limit = req.query.limit ? Number(req.query.limit) : 8;
  const results = await db.select().from(puzzlesTable)
    .where(eq(puzzlesTable.status, "open"))
    .orderBy(desc(puzzlesTable.completionCount))
    .limit(limit);
  const puzzles = await Promise.all(results.map(p => getPuzzleWithPieces(p.id)));
  res.json(puzzles.filter(Boolean));
});

router.post("/puzzles", async (req, res): Promise<void> => {
  const sub = getSub(req);
  if (!sub) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = CreatePuzzleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { image, message, type, cut, timeLimit, completionBadge, participationBadge, pieceMessages } = parsed.data;
  const now = Math.floor(Date.now() / 1000);
  const puzzleId = crypto.randomUUID();

  let completionBadgeId: string | null = null;
  let participationBadgeId: string | null = null;

  if (completionBadge) {
    completionBadgeId = crypto.randomUUID();
    await db.insert(badgesTable).values({ id: completionBadgeId, name: completionBadge.name, image: completionBadge.image, description: completionBadge.description ?? null });
  }
  if (participationBadge) {
    participationBadgeId = crypto.randomUUID();
    await db.insert(badgesTable).values({ id: participationBadgeId, name: participationBadge.name, image: participationBadge.image, description: participationBadge.description ?? null });
  }

  await db.insert(puzzlesTable).values({
    id: puzzleId,
    image,
    message: message ?? "",
    type,
    status: "pending",
    creatorSub: sub,
    createdOn: now,
    timeLimit: timeLimit ?? null,
    cutType: cut.type,
    cutCount: cut.count,
    completionBadgeId,
    participationBadgeId,
  });

  // Create pieces
  const pieceCount = cut.count;
  const pieceLimit = type === "group" ? 1 : 9999;
  for (let i = 0; i < pieceCount; i++) {
    await db.insert(piecesTable).values({
      id: crypto.randomUUID(),
      puzzleId,
      image,
      position: i,
      limit: pieceLimit,
      message: pieceMessages?.[i] ?? "",
    });
  }

  await db.insert(activityTable).values({
    id: crypto.randomUUID(),
    userSub: sub,
    type: "created_puzzle",
    on: now,
    details: `Created a new puzzle`,
  });

  const puzzle = await getPuzzleWithPieces(puzzleId);
  res.status(201).json(puzzle);
});

router.get("/puzzles/:id", async (req, res): Promise<void> => {
  const puzzle = await getPuzzleWithPieces(req.params.id);
  if (!puzzle) { res.status(404).json({ error: "Not found" }); return; }

  const sub = getSub(req);
  if (sub === puzzle.createdBy.sub) {
    const participants = await db.select().from(puzzleParticipantsTable).where(eq(puzzleParticipantsTable.puzzleId, req.params.id));
    const completers = participants.filter(p => p.completed === 1);
    const participantUsers = await Promise.all(participants.map(p => db.select().from(usersTable).where(eq(usersTable.sub, p.userSub)).limit(1)));
    const completerUsers = await Promise.all(completers.map(p => db.select().from(usersTable).where(eq(usersTable.sub, p.userSub)).limit(1)));

    res.json({
      ...puzzle,
      completers: completerUsers.map(u => u[0] ? { sub: u[0].sub, name: u[0].name, avatar: u[0].avatar } : null).filter(Boolean),
      participants: participantUsers.map(u => u[0] ? { sub: u[0].sub, name: u[0].name, avatar: u[0].avatar } : null).filter(Boolean),
    });
    return;
  }
  res.json(puzzle);
});

router.patch("/puzzles/:id", async (req, res): Promise<void> => {
  const sub = getSub(req);
  if (!sub) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = UpdatePuzzleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const puzzles = await db.select().from(puzzlesTable).where(eq(puzzlesTable.id, req.params.id)).limit(1);
  if (puzzles.length === 0) { res.status(404).json({ error: "Not found" }); return; }
  if (puzzles[0].creatorSub !== sub) { res.status(403).json({ error: "Forbidden" }); return; }

  const updates: Partial<typeof puzzles[0]> = {};
  if (parsed.data.message !== undefined) updates.message = parsed.data.message;
  if (parsed.data.timeLimit !== undefined) updates.timeLimit = parsed.data.timeLimit;

  await db.update(puzzlesTable).set(updates).where(eq(puzzlesTable.id, req.params.id));
  if (parsed.data.pieceMessages) {
    for (const pieceMessage of parsed.data.pieceMessages) {
      await db.update(piecesTable)
        .set({ message: pieceMessage.message })
        .where(and(eq(piecesTable.puzzleId, req.params.id), eq(piecesTable.position, pieceMessage.position)));
    }
  }
  const updated = await getPuzzleWithPieces(req.params.id);
  res.json(updated);
});

router.delete("/puzzles/:id", async (req, res): Promise<void> => {
  const sub = getSub(req);
  if (!sub) { res.status(401).json({ error: "Unauthorized" }); return; }

  const puzzles = await db.select().from(puzzlesTable).where(eq(puzzlesTable.id, req.params.id)).limit(1);
  if (puzzles.length === 0) { res.status(404).json({ error: "Not found" }); return; }
  if (puzzles[0].creatorSub !== sub) { res.status(403).json({ error: "Forbidden" }); return; }

  const puzzlePieces = await db.select({ id: piecesTable.id }).from(piecesTable).where(eq(piecesTable.puzzleId, req.params.id));
  for (const piece of puzzlePieces) {
    await db.delete(pieceCollectionsTable).where(eq(pieceCollectionsTable.pieceId, piece.id));
  }
  await db.delete(piecesTable).where(eq(piecesTable.puzzleId, req.params.id));
  await db.delete(puzzleParticipantsTable).where(eq(puzzleParticipantsTable.puzzleId, req.params.id));
  await db.delete(puzzlesTable).where(eq(puzzlesTable.id, req.params.id));
  res.status(204).send();
});

router.post("/puzzles/:id/publish", async (req, res): Promise<void> => {
  const sub = getSub(req);
  if (!sub) { res.status(401).json({ error: "Unauthorized" }); return; }

  const puzzles = await db.select().from(puzzlesTable).where(eq(puzzlesTable.id, req.params.id)).limit(1);
  if (puzzles.length === 0) { res.status(404).json({ error: "Not found" }); return; }
  if (puzzles[0].creatorSub !== sub) { res.status(403).json({ error: "Forbidden" }); return; }

  await db.update(puzzlesTable).set({ status: "open" }).where(eq(puzzlesTable.id, req.params.id));

  await db.insert(activityTable).values({
    id: crypto.randomUUID(),
    userSub: sub,
    type: "published_puzzle",
    on: Math.floor(Date.now() / 1000),
    details: `Published a puzzle`,
  });

  const updated = await getPuzzleWithPieces(req.params.id);
  res.json(updated);
});

router.post("/puzzles/:id/close", async (req, res): Promise<void> => {
  const sub = getSub(req);
  if (!sub) { res.status(401).json({ error: "Unauthorized" }); return; }

  const puzzles = await db.select().from(puzzlesTable).where(eq(puzzlesTable.id, req.params.id)).limit(1);
  if (puzzles.length === 0) { res.status(404).json({ error: "Not found" }); return; }
  if (puzzles[0].creatorSub !== sub) { res.status(403).json({ error: "Forbidden" }); return; }

  const now = Math.floor(Date.now() / 1000);
  await db.update(puzzlesTable).set({ status: "closed", closeType: "cancelled", closedOn: now }).where(eq(puzzlesTable.id, req.params.id));
  const updated = await getPuzzleWithPieces(req.params.id);
  res.json(updated);
});

router.get("/puzzles/:id/pieces", async (req, res): Promise<void> => {
  const pieces = await db.select().from(piecesTable).where(eq(piecesTable.puzzleId, req.params.id));
  const collections = await db.select().from(pieceCollectionsTable);

  const result = await Promise.all(pieces.map(async p => {
    const pieceCols = collections.filter(c => c.pieceId === p.id);
    const collected = await Promise.all(pieceCols.map(async c => {
      const u = await db.select().from(usersTable).where(eq(usersTable.sub, c.userSub)).limit(1);
      return { by: { sub: c.userSub, name: u[0]?.name ?? "Unknown", avatar: u[0]?.avatar ?? "" }, on: c.collectedOn };
    }));
    return { ...p, shareUrl: buildShareUrl(p.id), collected };
  }));

  res.json(result);
});

export default router;
