import { TRPCError } from "@trpc/server";
import { ENV } from "../_core/env";
import { updateSignatureRequest } from "../db";
import { emailsMatch } from "@shared/email";

function normalizeAppUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function isLocalhostUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname;
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "[::1]"
    );
  } catch {
    return false;
  }
}

function getRequestOrigin(req?: import("express").Request): string | null {
  if (!req) return null;

  const origin = req.headers.origin;
  if (origin && typeof origin === "string") {
    return normalizeAppUrl(origin);
  }

  const host = req.headers["x-forwarded-host"] || req.headers.host;
  if (!host) return null;

  const selectedHost = Array.isArray(host) ? host[0] : host;
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const protocol = Array.isArray(proto) ? proto[0] : proto;
  return normalizeAppUrl(`${protocol}://${selectedHost}`);
}

/** Returns the canonical app URL. Development localhost requests may override APP_URL. */
export function getAppUrlOrThrow(req?: import("express").Request): string {
  const requestOrigin = getRequestOrigin(req);

  if (!ENV.isProduction && requestOrigin && isLocalhostUrl(requestOrigin)) {
    return requestOrigin;
  }

  if (ENV.appUrl) {
    return ENV.appUrl;
  }

  if (!ENV.isProduction && requestOrigin) {
    return requestOrigin;
  }

  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "APP_URL is not configured. Cannot generate email links.",
  });
}

/** Prefer claimed user ownership over email fallback when validating signer access. */
export function assertSignerOwnership(
  request: { signerUserId?: number | null; signerEmail: string | null },
  user: { id: number; email: string | null },
  forbiddenMessage: string,
) {
  if (request.signerUserId != null) {
    if (user.id !== request.signerUserId) {
      throw new TRPCError({ code: "FORBIDDEN", message: forbiddenMessage });
    }
    return;
  }

  if (!emailsMatch(user.email, request.signerEmail)) {
    throw new TRPCError({ code: "FORBIDDEN", message: forbiddenMessage });
  }
}

/**
 * If signerUserId is set to a different user but the email matches the current user,
 * update signerUserId to the current user (re-claim stale ownership).
 * This handles cases where a user's account was recreated (new DB ID, same email).
 * Only applies to staff ownership recovery. Public PDF download keeps strict ID enforcement.
 */
export async function reclaimIfEmailMatches(
  request: { id: number; signerUserId?: number | null; signerEmail: string | null },
  user: { id: number; email: string | null },
): Promise<void> {
  if (request.signerUserId == null || request.signerUserId === user.id) return;
  if (!emailsMatch(user.email, request.signerEmail)) return;
  // Email matches — transfer ownership to current user
  try {
    await updateSignatureRequest(request.id, { signerUserId: user.id });
    (request as { signerUserId: number | null }).signerUserId = user.id;
  } catch {
    // Best-effort: if update fails, assertSignerOwnership will throw accessDenied
  }
}
