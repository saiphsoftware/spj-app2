import { Router } from "express";
import { db, packagesTable, purchasesTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { CreateCheckoutBody } from "@workspace/api-zod";

const router = Router();

function getSub(req: any): string | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    return Buffer.from(auth.slice(7), "base64").toString().split(":")[0];
  } catch { return null; }
}

router.get("/store/packages", async (_req, res): Promise<void> => {
  const packages = await db.select().from(packagesTable);
  res.json(packages.map(p => ({
    id: p.id,
    puzzleCount: p.puzzleCount,
    price: p.price,
    originalPrice: p.originalPrice,
    discountName: p.discountName,
    popular: p.popular === 1,
  })));
});

router.post("/store/checkout", async (req, res): Promise<void> => {
  const sub = getSub(req);
  if (!sub) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = CreateCheckoutBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { packageId } = parsed.data;
  const pkgs = await db.select().from(packagesTable).where(eq(packagesTable.id, packageId)).limit(1);
  if (pkgs.length === 0) { res.status(404).json({ error: "Package not found" }); return; }

  const pkg = pkgs[0];
  const now = Math.floor(Date.now() / 1000);
  const txid = crypto.randomUUID();

  await db.insert(purchasesTable).values({
    id: crypto.randomUUID(),
    userSub: sub,
    packageId: pkg.id,
    price: pkg.price,
    txid,
    status: "success",
    purchasedOn: now,
  });

  const user = await db.select().from(usersTable).where(eq(usersTable.sub, sub)).limit(1);
  const newRemaining = (user[0]?.remainingPuzzles ?? 0) + pkg.puzzleCount;
  await db.update(usersTable).set({ remainingPuzzles: newRemaining }).where(eq(usersTable.sub, sub));

  res.json({ success: true, txid, puzzlesAdded: pkg.puzzleCount, remainingPuzzles: newRemaining });
});

export default router;
