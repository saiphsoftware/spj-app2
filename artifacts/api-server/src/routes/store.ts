import { Router } from "express";
import { db, packagesTable, purchasesTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { CapturePayPalOrderBody, CreatePayPalOrderBody } from "@workspace/api-zod";

const router = Router();
type PayPalEnvironment = "sandbox" | "live";

type PayPalOrderResponse = {
  id?: string;
  status?: string;
  links?: Array<{ href?: string; rel?: string }>;
  purchase_units?: Array<{
    custom_id?: string;
    amount?: { currency_code?: string; value?: string };
    payments?: { captures?: Array<{ status?: string }> };
  }>;
};

class PayPalRequestError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 502,
  ) {
    super(message);
    this.name = "PayPalRequestError";
  }
}

function getSub(req: any): string | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    return Buffer.from(auth.slice(7), "base64").toString().split(":")[0];
  } catch { return null; }
}

function getPayPalEnvironment(): PayPalEnvironment {
  return process.env.PAYPAL_ENVIRONMENT === "live" ? "live" : "sandbox";
}

function isPayPalConfigured() {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

function getPayPalApiUrl() {
  return getPayPalEnvironment() === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

function getCheckoutOrigin(req: any) {
  if (process.env.PAYPAL_RETURN_URL_BASE) {
    return process.env.PAYPAL_RETURN_URL_BASE.replace(/\/$/, "");
  }

  const forwardedProtocol = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = req.get("x-forwarded-host")?.split(",")[0]?.trim();
  const protocol = forwardedProtocol || req.protocol || "http";
  const host = forwardedHost || req.get("host") || "localhost";
  return `${protocol}://${host}`;
}

async function getPayPalAccessToken() {
  if (!isPayPalConfigured()) {
    throw new PayPalRequestError("PayPal is not configured.", 503);
  }

  const credentials = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`,
  ).toString("base64");
  const response = await fetch(`${getPayPalApiUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Language": "en_US",
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const body = await response.json().catch(() => ({})) as { access_token?: string };
  if (!response.ok || !body.access_token) {
    throw new PayPalRequestError("PayPal authentication failed.");
  }
  return body.access_token;
}

async function paypalRequest<T>(path: string, init: RequestInit = {}) {
  const accessToken = await getPayPalAccessToken();
  const response = await fetch(`${getPayPalApiUrl()}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new PayPalRequestError(`PayPal request failed with status ${response.status}.`);
  }
  return body as T;
}

function encodeOrderMetadata(userSub: string, packageId: string) {
  return Buffer.from(JSON.stringify({ userSub, packageId })).toString("base64url");
}

function decodeOrderMetadata(value: unknown): { userSub: string; packageId: string } | null {
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (typeof parsed.userSub !== "string" || typeof parsed.packageId !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

function getPayPalErrorStatus(error: unknown) {
  return error instanceof PayPalRequestError ? error.statusCode : 502;
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
  res.status(410).json({ error: "Demo checkout is disabled. Use PayPal checkout instead." });
});

router.get("/store/paypal/config", (_req, res): void => {
  res.json({
    configured: isPayPalConfigured(),
    environment: getPayPalEnvironment(),
  });
});

router.post("/store/paypal/order", async (req, res): Promise<void> => {
  const sub = getSub(req);
  if (!sub) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = CreatePayPalOrderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (!isPayPalConfigured()) {
    res.status(503).json({ error: "PayPal is not configured yet." });
    return;
  }

  const pkgs = await db.select().from(packagesTable).where(eq(packagesTable.id, parsed.data.packageId)).limit(1);
  if (pkgs.length === 0) { res.status(404).json({ error: "Package not found" }); return; }

  const pkg = pkgs[0];
  const packageUrl = encodeURIComponent(pkg.id);
  const checkoutOrigin = getCheckoutOrigin(req);
  const order = {
    intent: "CAPTURE",
    purchase_units: [{
      reference_id: pkg.id,
      custom_id: encodeOrderMetadata(sub, pkg.id),
      description: `${pkg.puzzleCount} Puzzle Pack`,
      amount: {
        currency_code: "USD",
        value: pkg.price.toFixed(2),
      },
    }],
    application_context: {
      brand_name: "SpotJiggy",
      landing_page: "LOGIN",
      user_action: "PAY_NOW",
      shipping_preference: "NO_SHIPPING",
      return_url: `${checkoutOrigin}/store/checkout?packageId=${packageUrl}&paypal=success`,
      cancel_url: `${checkoutOrigin}/store/checkout?packageId=${packageUrl}&paypal=cancelled`,
    },
  };

  try {
    const created = await paypalRequest<PayPalOrderResponse>("/v2/checkout/orders", {
      method: "POST",
      body: JSON.stringify(order),
    });
    const approvalUrl = created.links?.find((link) => link.rel === "approve" || link.rel === "payer-action")?.href;
    if (!created.id || !approvalUrl) {
      throw new PayPalRequestError("PayPal returned an incomplete order.");
    }

    res.json({
      orderId: created.id,
      approvalUrl,
      amount: pkg.price,
      currency: "USD",
      environment: getPayPalEnvironment(),
    });
  } catch (error) {
    req.log.error({ err: error }, "PayPal order creation failed");
    res.status(getPayPalErrorStatus(error)).json({ error: "Could not start PayPal checkout." });
  }
});

router.post("/store/paypal/capture", async (req, res): Promise<void> => {
  const sub = getSub(req);
  if (!sub) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = CapturePayPalOrderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (!isPayPalConfigured()) {
    res.status(503).json({ error: "PayPal is not configured yet." });
    return;
  }

  const { orderId } = parsed.data;

  try {
    const order = await paypalRequest<PayPalOrderResponse>(
      `/v2/checkout/orders/${encodeURIComponent(orderId)}`,
    );
    const metadata = decodeOrderMetadata(order.purchase_units?.[0]?.custom_id);
    if (!metadata || metadata.userSub !== sub) {
      res.status(403).json({ error: "This PayPal order does not belong to your account." });
      return;
    }

    const pkgs = await db.select().from(packagesTable).where(eq(packagesTable.id, metadata.packageId)).limit(1);
    if (pkgs.length === 0) { res.status(404).json({ error: "Package not found" }); return; }
    const pkg = pkgs[0];
    const paypalAmount = order.purchase_units?.[0]?.amount;
    if (
      paypalAmount?.currency_code !== "USD" ||
      Math.round(Number(paypalAmount.value) * 100) !== Math.round(pkg.price * 100)
    ) {
      res.status(400).json({ error: "PayPal order amount does not match the selected package." });
      return;
    }

    const existingPurchase = await db.select().from(purchasesTable).where(eq(purchasesTable.txid, orderId)).limit(1);
    if (existingPurchase.length > 0) {
      const user = await db.select().from(usersTable).where(eq(usersTable.sub, sub)).limit(1);
      res.json({
        success: true,
        txid: orderId,
        puzzlesAdded: 0,
        remainingPuzzles: user[0]?.remainingPuzzles ?? 0,
      });
      return;
    }

    const captured = await paypalRequest<PayPalOrderResponse>(
      `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
      { method: "POST", body: JSON.stringify({}) },
    );
    const captureStatus = captured.purchase_units?.[0]?.payments?.captures?.[0]?.status ?? captured.status;
    if (captureStatus !== "COMPLETED") {
      res.status(409).json({ error: "PayPal payment was not completed." });
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    await db.insert(purchasesTable).values({
      id: crypto.randomUUID(),
      userSub: sub,
      packageId: pkg.id,
      price: pkg.price,
      txid: orderId,
      status: "success",
      purchasedOn: now,
    });

    const user = await db.select().from(usersTable).where(eq(usersTable.sub, sub)).limit(1);
    const newRemaining = (user[0]?.remainingPuzzles ?? 0) + pkg.puzzleCount;
    await db.update(usersTable).set({ remainingPuzzles: newRemaining }).where(eq(usersTable.sub, sub));

    res.json({
      success: true,
      txid: orderId,
      puzzlesAdded: pkg.puzzleCount,
      remainingPuzzles: newRemaining,
    });
  } catch (error) {
    req.log.error({ err: error, orderId }, "PayPal order capture failed");
    res.status(getPayPalErrorStatus(error)).json({ error: "Could not complete PayPal checkout." });
  }
});

export default router;
