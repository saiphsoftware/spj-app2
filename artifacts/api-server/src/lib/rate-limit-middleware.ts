import { createHash } from "node:crypto";
import type { Request, RequestHandler } from "express";

export type RateLimitDecision = {
  allowed: boolean;
  retryAfterSeconds: number;
};

export type RateLimitRule = {
  scope: string;
  limit: number;
  windowMs: number;
  identity: (request: Request) => string;
};

export type ConsumeRateLimit = (
  bucket: string,
  limit: number,
  windowMs: number,
) => Promise<RateLimitDecision>;

export function readPositiveIntegerSetting(
  env: NodeJS.ProcessEnv,
  name: string,
  defaultValue: number,
): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === "") return defaultValue;

  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}

function makeBucket(scope: string, identity: string): string {
  const digest = createHash("sha256").update(identity).digest("hex");
  return `${scope}:${digest}`;
}

export function createRateLimitMiddleware(
  rules: RateLimitRule[],
  consume: ConsumeRateLimit,
): RequestHandler {
  return async (request, response, next): Promise<void> => {
    const decisions = await Promise.all(
      rules.map((rule) =>
        consume(
          makeBucket(rule.scope, rule.identity(request)),
          rule.limit,
          rule.windowMs,
        ),
      ),
    );
    const blocked = decisions.filter((decision) => !decision.allowed);

    if (blocked.length > 0) {
      const retryAfterSeconds = Math.max(
        ...blocked.map((decision) => decision.retryAfterSeconds),
      );
      response.setHeader("Retry-After", String(retryAfterSeconds));
      response.status(429).json({
        error: `Too many requests. Try again in ${retryAfterSeconds} seconds.`,
        retryAfterSeconds,
      });
      return;
    }

    next();
  };
}
