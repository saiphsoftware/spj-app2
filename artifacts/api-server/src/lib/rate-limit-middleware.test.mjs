import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createRateLimitMiddleware,
  readPositiveIntegerSetting,
} from "./rate-limit-middleware.ts";

function createResponse() {
  return {
    headers: {},
    statusCode: 200,
    body: undefined,
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function createRequest(ip = "192.0.2.1", email = "test@example.com") {
  return { ip, body: { email } };
}

test("rate limits are shared across middleware instances and return retry guidance", async () => {
  const hits = new Map();
  const consume = async (bucket, limit) => {
    const count = (hits.get(bucket) ?? 0) + 1;
    hits.set(bucket, count);
    return { allowed: count <= limit, retryAfterSeconds: 37 };
  };
  const rules = [
    {
      scope: "auth:login:email",
      limit: 2,
      windowMs: 60_000,
      identity: (request) => request.body.email,
    },
  ];
  const firstInstance = createRateLimitMiddleware(rules, consume);
  const secondInstance = createRateLimitMiddleware(rules, consume);

  for (const handler of [firstInstance, secondInstance]) {
    const response = createResponse();
    let nextCalled = false;
    await handler(createRequest(), response, () => {
      nextCalled = true;
    });
    assert.equal(response.statusCode, 200);
    assert.equal(nextCalled, true);
  }

  const response = createResponse();
  let nextCalled = false;
  await secondInstance(createRequest(), response, () => {
    nextCalled = true;
  });

  assert.equal(response.statusCode, 429);
  assert.equal(response.headers["Retry-After"], "37");
  assert.deepEqual(response.body, {
    error: "Too many requests. Try again in 37 seconds.",
    retryAfterSeconds: 37,
  });
  assert.equal(nextCalled, false);
});

test("rate-limit storage keys do not contain the original identity", async () => {
  let receivedBucket;
  const handler = createRateLimitMiddleware(
    [
      {
        scope: "auth:login:email",
        limit: 10,
        windowMs: 60_000,
        identity: (request) => request.body.email,
      },
    ],
    async (bucket) => {
      receivedBucket = bucket;
      return { allowed: true, retryAfterSeconds: 60 };
    },
  );

  await handler(createRequest("192.0.2.1", "Private.Person@example.com"), createResponse(), () => {});
  assert.match(receivedBucket, /^auth:login:email:[a-f0-9]{64}$/);
  assert.equal(receivedBucket.includes("Private.Person@example.com"), false);
});

test("configuration accepts positive integers and rejects invalid values", () => {
  assert.equal(
    readPositiveIntegerSetting({ AUTH_LOGIN_MAX: "8" }, "AUTH_LOGIN_MAX", 10),
    8,
  );
  assert.equal(readPositiveIntegerSetting({}, "AUTH_LOGIN_MAX", 10), 10);
  assert.throws(
    () => readPositiveIntegerSetting({ AUTH_LOGIN_MAX: "0" }, "AUTH_LOGIN_MAX", 10),
    /AUTH_LOGIN_MAX must be a positive integer/,
  );
});
