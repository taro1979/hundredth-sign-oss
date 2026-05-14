/**
 * E2E Auth Helper — generates valid JWT session cookies
 * without importing any server module.
 *
 * Mirrors the signing logic in server/_core/sdk.ts signSession()
 */
import { SignJWT } from "jose";
import { E2E_BASE_URL } from "./base-url";

const JWT_SECRET = process.env.JWT_SECRET ?? "e2e-test-secret-key-for-local-development";
const APP_ID = process.env.VITE_APP_ID ?? "e2e-test-app";
const COOKIE_NAME = "app_session_id";
const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;

// ── Test users ──

export const TEST_USERS = {
  superAdmin: {
    openId: "e2e-super-admin",
    name: "E2E Super Admin",
    email: "superadmin@e2e-test.local",
  },
  owner: {
    openId: "e2e-owner",
    name: "E2E Owner",
    email: "owner@e2e-test.local",
  },
  member: {
    openId: "e2e-member",
    name: "E2E Member",
    email: "member@e2e-test.local",
  },
  signer: {
    openId: "e2e-signer",
    name: "E2E Signer",
    email: "signer@e2e-test.local",
  },
} as const;

// ── JWT signing (same logic as sdk.signSession) ──

async function signSession(openId: string, name: string): Promise<string> {
  const secretKey = new TextEncoder().encode(JWT_SECRET);
  const issuedAt = Date.now();
  const expirationSeconds = Math.floor((issuedAt + ONE_YEAR_MS) / 1000);

  return new SignJWT({ openId, appId: APP_ID, name })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expirationSeconds)
    .sign(secretKey);
}

// ── Cookie helpers ──

export type SessionCookie = {
  name: string;
  value: string;
  url: string;
  httpOnly: boolean;
  sameSite: "None" | "Lax" | "Strict";
  secure: boolean;
};

/**
 * Creates a Playwright-compatible session cookie.
 *
 * Notes:
 *  - Use `url` (not domain+path) so Playwright correctly scopes the cookie to the origin.
 *  - `sameSite: "Lax"` is required for HTTP; Chromium rejects SameSite=None without Secure.
 */
export async function createSessionCookie(
  user: (typeof TEST_USERS)[keyof typeof TEST_USERS],
  baseUrl = E2E_BASE_URL,
): Promise<SessionCookie> {
  const token = await signSession(user.openId, user.name);
  return {
    name: COOKIE_NAME,
    value: token,
    url: baseUrl,
    httpOnly: true,
    sameSite: "Lax",
    secure: false,
  };
}
