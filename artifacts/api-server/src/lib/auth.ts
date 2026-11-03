import type { Request } from "express";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, sessionsTable } from "@workspace/db";
import crypto from "crypto";

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

function getBearerToken(req: Pick<Request, "headers">): string | null {
  const authorization = req.headers.authorization;
  if (!authorization) return null;

  const [scheme, token, ...extra] = authorization.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== "bearer" || !token || extra.length > 0) {
    return null;
  }
  return token;
}

export async function createSession(userSub: string): Promise<string> {
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  await db.insert(sessionsTable).values({
    id,
    userSub,
    expiresAt: now + SESSION_TTL_SECONDS,
    revokedAt: null,
  });
  return id;
}

export async function getAuthenticatedSub(
  req: Pick<Request, "headers">,
): Promise<string | null> {
  const sessionId = getBearerToken(req);
  if (!sessionId) return null;

  const now = Math.floor(Date.now() / 1000);
  const sessions = await db
    .select({ userSub: sessionsTable.userSub })
    .from(sessionsTable)
    .where(and(
      eq(sessionsTable.id, sessionId),
      gt(sessionsTable.expiresAt, now),
      isNull(sessionsTable.revokedAt),
    ))
    .limit(1);

  return sessions[0]?.userSub ?? null;
}

export async function revokeSession(
  req: Pick<Request, "headers">,
): Promise<void> {
  const sessionId = getBearerToken(req);
  if (!sessionId) return;

  await db
    .update(sessionsTable)
    .set({ revokedAt: Math.floor(Date.now() / 1000) })
    .where(and(
      eq(sessionsTable.id, sessionId),
      isNull(sessionsTable.revokedAt),
    ));
}

export async function revokeUserSessions(userSub: string): Promise<void> {
  await db
    .update(sessionsTable)
    .set({ revokedAt: Math.floor(Date.now() / 1000) })
    .where(and(
      eq(sessionsTable.userSub, userSub),
      isNull(sessionsTable.revokedAt),
    ));
}
