import { sql } from "drizzle-orm";
import { db, authRateLimitsTable } from "@workspace/db";
import {
  createRateLimitMiddleware,
  readPositiveIntegerSetting,
  type RateLimitRule,
} from "./rate-limit-middleware";

const CLEANUP_INTERVAL_MS = 15 * 60 * 1000;
let lastCleanupAt = 0;
let schemaInitialization: Promise<void> | undefined;

async function ensureRateLimitTable(): Promise<void> {
  schemaInitialization ??= (async () => {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS auth_rate_limits (
        bucket TEXT PRIMARY KEY,
        request_count INTEGER NOT NULL,
        reset_at TIMESTAMPTZ NOT NULL
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS auth_rate_limits_reset_at_idx
      ON auth_rate_limits (reset_at)
    `);
  })().catch((error: unknown) => {
    schemaInitialization = undefined;
    throw error;
  });
  await schemaInitialization;
}

async function consumeSharedRateLimit(
  bucket: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  await ensureRateLimitTable();
  const now = Date.now();
  if (now - lastCleanupAt >= CLEANUP_INTERVAL_MS) {
    // Expired keys are removed periodically so unique client identities do
    // not cause the shared table to grow indefinitely.
    await db.execute(sql`
      DELETE FROM auth_rate_limits
      WHERE reset_at <= CURRENT_TIMESTAMP
    `);
    lastCleanupAt = now;
  }

  const [row] = await db
    .insert(authRateLimitsTable)
    .values({
      bucket,
      requestCount: 1,
      resetAt: sql`CURRENT_TIMESTAMP + ${windowMs} * interval '1 millisecond'`,
    })
    .onConflictDoUpdate({
      target: authRateLimitsTable.bucket,
      set: {
        requestCount: sql`
          CASE
            WHEN ${authRateLimitsTable.resetAt} <= CURRENT_TIMESTAMP THEN 1
            ELSE ${authRateLimitsTable.requestCount} + 1
          END
        `,
        resetAt: sql`
          CASE
            WHEN ${authRateLimitsTable.resetAt} <= CURRENT_TIMESTAMP
              THEN CURRENT_TIMESTAMP + ${windowMs} * interval '1 millisecond'
            ELSE ${authRateLimitsTable.resetAt}
          END
        `,
      },
    })
    .returning({
      requestCount: authRateLimitsTable.requestCount,
      resetAt: authRateLimitsTable.resetAt,
    });

  if (!row) {
    throw new Error("The shared authentication rate limit could not be read.");
  }

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((row.resetAt.getTime() - Date.now()) / 1000),
  );
  return {
    allowed: row.requestCount <= limit,
    retryAfterSeconds,
  };
}

function configuredRule(
  scope: string,
  envPrefix: string,
  defaultLimit: number,
  defaultWindowMs: number,
  identity: RateLimitRule["identity"],
): RateLimitRule {
  return {
    scope,
    limit: readPositiveIntegerSetting(
      process.env,
      `${envPrefix}_MAX`,
      defaultLimit,
    ),
    windowMs: readPositiveIntegerSetting(
      process.env,
      `${envPrefix}_WINDOW_MS`,
      defaultWindowMs,
    ),
    identity,
  };
}

const ipIdentity: RateLimitRule["identity"] = (request) => request.ip || "unknown";
const emailIdentity: RateLimitRule["identity"] = (request) => {
  const email = request.body?.email;
  return typeof email === "string" ? email.trim().toLowerCase() : "missing-email";
};
const resetTokenIdentity: RateLimitRule["identity"] = (request) => {
  const token = request.body?.token;
  return typeof token === "string" ? token : "missing-token";
};

const loginRules = [
  configuredRule("auth:login:ip", "AUTH_LOGIN_IP", 40, 15 * 60 * 1000, ipIdentity),
  configuredRule("auth:login:email", "AUTH_LOGIN_EMAIL", 10, 15 * 60 * 1000, emailIdentity),
];
const registerRules = [
  configuredRule("auth:register:ip", "AUTH_REGISTER_IP", 10, 60 * 60 * 1000, ipIdentity),
  configuredRule("auth:register:email", "AUTH_REGISTER_EMAIL", 5, 60 * 60 * 1000, emailIdentity),
];
const forgotPasswordRules = [
  configuredRule("auth:forgot-password:ip", "AUTH_FORGOT_PASSWORD_IP", 20, 60 * 60 * 1000, ipIdentity),
  configuredRule("auth:forgot-password:email", "AUTH_FORGOT_PASSWORD_EMAIL", 5, 60 * 60 * 1000, emailIdentity),
];
const resetPasswordRules = [
  configuredRule("auth:reset-password:ip", "AUTH_RESET_PASSWORD_IP", 20, 60 * 60 * 1000, ipIdentity),
  configuredRule("auth:reset-password:token", "AUTH_RESET_PASSWORD_TOKEN", 10, 60 * 60 * 1000, resetTokenIdentity),
];

export const loginRateLimit = createRateLimitMiddleware(loginRules, consumeSharedRateLimit);
export const registerRateLimit = createRateLimitMiddleware(registerRules, consumeSharedRateLimit);
export const forgotPasswordRateLimit = createRateLimitMiddleware(
  forgotPasswordRules,
  consumeSharedRateLimit,
);
export const resetPasswordRateLimit = createRateLimitMiddleware(
  resetPasswordRules,
  consumeSharedRateLimit,
);
