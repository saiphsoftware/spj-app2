import { Router } from "express";
import { db, usersTable, activityTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import {
  clearSessionCookie,
  getAuthenticatedSub,
  hashPassword,
  passwordHashNeedsUpgrade,
  setSessionCookie,
  verifyPassword,
} from "../lib/auth";
import {
  RegisterBody,
  LoginBody,
  ForgotPasswordBody,
  ResetPasswordBody,
} from "@workspace/api-zod";

const router = Router();
const DEMO_EMAIL = "demo@spotjiggy.com";
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;
const resetTokens = new Map<string, { sub: string; expiresAt: number }>();

function toPublicUser(user: typeof usersTable.$inferSelect) {
  return {
    sub: user.sub,
    name: user.name,
    avatar: user.avatar,
    type: user.type,
    created: user.created,
    remainingPuzzles: user.remainingPuzzles,
  };
}

function avatarUrl(name: string): string {
  const seed = encodeURIComponent(name);
  return `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${seed}`;
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const name = parsed.data.name.trim();
  const email = parsed.data.email.trim().toLowerCase();
  const { password } = parsed.data;
  if (!name) {
    res.status(400).json({ error: "Name is required" });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing.length > 0) {
    res.status(400).json({ error: "Email already in use" });
    return;
  }

  const sub = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const user = await db.insert(usersTable).values({
    sub,
    name,
    avatar: avatarUrl(name),
    type: "site",
    email,
    passwordHash: await hashPassword(password),
    remainingPuzzles: 3,
    created: now,
  }).returning();

  await db.insert(activityTable).values({
    id: crypto.randomUUID(),
    userSub: sub,
    type: "joined",
    on: now,
    details: "Joined SpotJiggy",
  });

  setSessionCookie(req, res, sub);
  res.status(201).json({ user: toPublicUser(user[0]) });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();
  const { password } = parsed.data;
  const users = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (users.length === 0 || !(await verifyPassword(password, users[0].passwordHash))) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const user = users[0];
  if (passwordHashNeedsUpgrade(user.passwordHash)) {
    await db.update(usersTable)
      .set({ passwordHash: await hashPassword(password) })
      .where(eq(usersTable.sub, user.sub));
  }

  setSessionCookie(req, res, user.sub);
  res.json({ user: toPublicUser(user) });
});

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const parsed = ForgotPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const users = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);

  // The demo account intentionally bypasses email verification so it remains
  // usable in environments where no mail provider is configured.
  if (process.env.NODE_ENV !== "production" && email === DEMO_EMAIL && users.length > 0) {
    const token = crypto.randomBytes(32).toString("hex");
    resetTokens.set(token, {
      sub: users[0].sub,
      expiresAt: Date.now() + RESET_TOKEN_TTL_MS,
    });
    res.json({
      success: true,
      requiresVerification: false,
      message: "Demo reset link created.",
      demoResetToken: token,
    });
    return;
  }

  // Keep the response intentionally generic for non-demo addresses. A mail
  // provider can be connected later to deliver a token without changing this
  // public contract.
  res.json({
    success: true,
    requiresVerification: true,
    message: "Email verification is required to reset this account.",
  });
});

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const parsed = ResetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const reset = resetTokens.get(parsed.data.token);
  if (!reset || reset.expiresAt < Date.now()) {
    if (reset) resetTokens.delete(parsed.data.token);
    res.status(400).json({ error: "This reset link is invalid or expired." });
    return;
  }

  await db.update(usersTable)
    .set({ passwordHash: await hashPassword(parsed.data.password) })
    .where(eq(usersTable.sub, reset.sub));
  resetTokens.delete(parsed.data.token);

  res.json({ success: true, message: "Password updated. You can sign in now." });
});

router.post("/auth/logout", async (_req, res): Promise<void> => {
  clearSessionCookie(_req, res);
  res.json({ ok: true });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const sub = getAuthenticatedSub(req);
  if (!sub) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const users = await db.select().from(usersTable).where(eq(usersTable.sub, sub)).limit(1);
  if (users.length === 0) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json(toPublicUser(users[0]));
});

export default router;
