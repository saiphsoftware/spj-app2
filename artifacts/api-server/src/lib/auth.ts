import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";

const SESSION_COOKIE_NAME = "spotjiggy_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_TTL_SECONDS = SESSION_TTL_MS / 1000;
const SCRYPT_COST = 1 << 15;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const PASSWORD_KEY_LENGTH = 64;
const SESSION_SECRET = process.env.SESSION_SECRET;

if (!SESSION_SECRET) {
  throw new Error("SESSION_SECRET must be configured before the API server starts.");
}

function derivePasswordKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      PASSWORD_KEY_LENGTH,
      {
        N: SCRYPT_COST,
        r: SCRYPT_BLOCK_SIZE,
        p: SCRYPT_PARALLELIZATION,
        maxmem: 64 * 1024 * 1024,
      },
      (error, derivedKey) => {
        if (error) reject(error);
        else resolve(derivedKey);
      },
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derivePasswordKey(password, salt);
  return `scrypt-v1$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, storedHash: string | null): Promise<boolean> {
  if (!storedHash) return false;

  if (storedHash.startsWith("scrypt-v1$")) {
    const [, saltEncoded, keyEncoded, extra] = storedHash.split("$");
    if (!saltEncoded || !keyEncoded || extra !== undefined) return false;

    const salt = Buffer.from(saltEncoded, "base64url");
    const expectedKey = Buffer.from(keyEncoded, "base64url");
    if (salt.length !== 16 || expectedKey.length !== PASSWORD_KEY_LENGTH) return false;

    const actualKey = await derivePasswordKey(password, salt);
    return timingSafeEqual(actualKey, expectedKey);
  }

  // Verify the old hash once so existing accounts can be upgraded at login.
  const legacyKey = createHash("sha256").update(password + "spotjiggy_salt").digest();
  const storedKey = Buffer.from(storedHash, "hex");
  return storedKey.length === legacyKey.length && timingSafeEqual(storedKey, legacyKey);
}

export function passwordHashNeedsUpgrade(storedHash: string | null): boolean {
  return !storedHash?.startsWith("scrypt-v1$");
}

export function createSessionToken(sub: string, nowMs = Date.now()): string {
  const issuedAt = Math.floor(nowMs / 1000);
  const payload = Buffer.from(JSON.stringify({
    sub,
    iat: issuedAt,
    exp: issuedAt + SESSION_TTL_SECONDS,
    nonce: randomBytes(16).toString("base64url"),
  })).toString("base64url");
  const signature = createHmac("sha256", SESSION_SECRET!).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifySessionToken(token: string, nowMs = Date.now()): string | null {
  if (token.length > 2048) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;

  const expectedSignature = createHmac("sha256", SESSION_SECRET!).update(payload).digest();
  const actualSignature = Buffer.from(signature, "base64url");
  if (
    actualSignature.length !== expectedSignature.length ||
    !timingSafeEqual(actualSignature, expectedSignature)
  ) {
    return null;
  }

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const now = Math.floor(nowMs / 1000);
    if (
      typeof claims.sub !== "string" ||
      !claims.sub ||
      !Number.isSafeInteger(claims.iat) ||
      !Number.isSafeInteger(claims.exp) ||
      typeof claims.nonce !== "string" ||
      claims.iat > now + 60 ||
      claims.exp <= now ||
      claims.exp - claims.iat > SESSION_TTL_SECONDS
    ) {
      return null;
    }
    return claims.sub;
  } catch {
    return null;
  }
}

function isSecureRequest(req: Request): boolean {
  const forwardedProto = req.get("x-forwarded-proto")?.split(",")[0].trim().toLowerCase();
  return req.secure || forwardedProto === "https" || process.env.NODE_ENV === "production";
}

const sessionCookieOptions = (req: Request) => ({
  httpOnly: true,
  secure: isSecureRequest(req),
  sameSite: "lax" as const,
  path: "/api",
  maxAge: SESSION_TTL_MS,
});

export function setSessionCookie(req: Request, res: Response, sub: string): void {
  res.cookie(SESSION_COOKIE_NAME, createSessionToken(sub), sessionCookieOptions(req));
}

export function clearSessionCookie(req: Request, res: Response): void {
  const { maxAge: _maxAge, ...options } = sessionCookieOptions(req);
  res.clearCookie(SESSION_COOKIE_NAME, options);
}

export function getAuthenticatedSub(req: Request): string | null {
  const cookieToken = req.cookies?.[SESSION_COOKIE_NAME];
  const authorization = req.headers.authorization;
  const bearerToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;
  const token = typeof cookieToken === "string" ? cookieToken : bearerToken;
  return token ? verifySessionToken(token) : null;
}
