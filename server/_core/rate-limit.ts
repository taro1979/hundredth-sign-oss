import rateLimit, { type Store } from "express-rate-limit";
import type { Request, Response } from "express";
import { ENV } from "./env";

/**
 * Rate limit configuration values (exported for testability).
 * AC-009: server/_core/index.test.ts verifies these values.
 */
export const RATE_LIMIT_CONFIG = {
  global: { windowMs: 15 * 60 * 1000, max: 300 },
  accessCode: { windowMs: 15 * 60 * 1000, max: 5 },
  authCallback: { windowMs: 15 * 60 * 1000, max: 20 },
} as const;

/**
 * tRPC-compatible 429 error response handler.
 * express-rate-limit fires before the tRPC adapter, so the response must
 * match the tRPC httpBatchLink array format for proper client-side parsing.
 * Exported for testability (AC-005).
 */
export function tRPCRateLimitHandler(message: string) {
  return (_req: Request, res: Response) => {
    res.status(429).json([
      {
        error: {
          message,
          code: -32029,
          data: {
            code: "TOO_MANY_REQUESTS",
            httpStatus: 429,
          },
        },
      },
    ]);
  };
}

/**
 * Build a Redis-backed rate limit store if REDIS_URL is configured.
 * Falls back to in-memory (default) if Redis is unavailable or unconfigured.
 * FR-018, FR-019, FR-020
 */
/* v8 ignore start */
function buildRedisStore(prefix: string): Store | undefined {
  if (!ENV.redisUrl) return undefined;

  try {
    // Dynamic require to avoid crashing when Redis packages are not installed
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { default: RedisStore } = require("rate-limit-redis") as {
      default: new (opts: Record<string, unknown>) => Store;
    };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { default: Redis } = require("ioredis") as {
      default: new (url: string) => {
        on(event: string, listener: (...args: unknown[]) => void): void;
        sendCommand(...args: unknown[]): Promise<unknown>;
      };
    };

    const client = new Redis(ENV.redisUrl);
    client.on("error", (err: unknown) => {
      console.error("[RATE_LIMIT] Redis error:", err);
    });

    const store = new RedisStore({
      sendCommand: (...args: unknown[]) => client.sendCommand(...args),
      prefix,
    });

    console.log(`[RATE_LIMIT] Using Redis store for rate limiting (prefix: ${prefix})`);
    return store;
  } catch (err) {
    console.error("[RATE_LIMIT] Redis unavailable, falling back to in-memory store:", err);
    return undefined;
  }
}
/* v8 ignore stop */

// Global rate limiter: 300 req / 15 min per IP
export const globalLimiter = rateLimit({
  ...RATE_LIMIT_CONFIG.global,
  standardHeaders: true,
  legacyHeaders: false,
  store: buildRedisStore("rl:global:"),
  handler: tRPCRateLimitHandler("Too many requests, please try again later."),
});

// Strict limiter for access code verification: 5 req / 15 min per IP
export const accessCodeLimiter = rateLimit({
  ...RATE_LIMIT_CONFIG.accessCode,
  standardHeaders: true,
  legacyHeaders: false,
  store: buildRedisStore("rl:access:"),
  handler: tRPCRateLimitHandler("Too many access code attempts, please try again later."),
});

// Public auth callback limiter: 20 req / 15 min per IP
export const authCallbackLimiter = rateLimit({
  ...RATE_LIMIT_CONFIG.authCallback,
  standardHeaders: true,
  legacyHeaders: false,
  store: buildRedisStore("rl:auth:"),
  handler: tRPCRateLimitHandler("Too many authentication attempts, please try again later."),
});
