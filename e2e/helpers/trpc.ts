/**
 * E2E tRPC API helper — wraps Playwright request with correct format.
 *
 * tRPC v10 + superjson transformer:
 *   - Mutations (POST): body = { "json": payload }
 *   - Queries   (GET):  ?input={"json":payload}
 *   - Response:         { "result": { "data": { "json": data } } }
 *
 * Most document/template/contact procedures are orgProcedure,
 * requiring x-organization-id header.
 */
import type { Page } from "@playwright/test";
import { E2E_BASE_URL } from "../base-url";

const BASE_URL = E2E_BASE_URL;

/** Wrap a plain object in superjson's JSON envelope */
function wrap(input: unknown): Record<string, unknown> {
  return { json: input };
}

/** Unwrap superjson response: result.data.json */
function unwrap(body: unknown): unknown {
  if (typeof body !== "object" || body === null) return body;
  const b = body as Record<string, unknown>;
  const data = (b["result"] as Record<string, unknown> | undefined)?.["data"] as
    | Record<string, unknown>
    | undefined;
  return data?.["json"] ?? data ?? body;
}

/**
 * Get the first organization ID for the authenticated user.
 * Uses organization.list (protectedProcedure — no x-organization-id needed).
 *
 * getOrganizationsByUser returns rows with shape { org: Organization, membership: Membership },
 * so we must access orgs[0].org.id (not orgs[0].id).
 */
export async function getOrgId(page: Page): Promise<string> {
  const res = await page.request.get(`${BASE_URL}/api/trpc/organization.list`);
  if (!res.ok()) {
    throw new Error(`organization.list failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  const orgs = unwrap(body) as Array<{ org: { id: number } }>;
  if (!Array.isArray(orgs) || orgs.length === 0) {
    throw new Error(`No organizations found: ${JSON.stringify(body)}`);
  }
  return String(orgs[0].org.id);
}

/** tRPC mutation via POST */
export async function trpcMutation<T = unknown>(
  page: Page,
  procedure: string,
  input: unknown,
  orgId: string,
): Promise<T> {
  const res = await page.request.post(`${BASE_URL}/api/trpc/${procedure}`, {
    data: wrap(input),
    headers: {
      "Content-Type": "application/json",
      "x-organization-id": orgId,
    },
  });
  const body = await res.json();
  if (!res.ok()) {
    const err = (body as Record<string, unknown>)["error"];
    throw new Error(
      `${procedure} failed: ${res.status()} ${JSON.stringify(err ?? body)}`,
    );
  }
  return unwrap(body) as T;
}

/** tRPC query via GET with optional input */
export async function trpcQuery<T = unknown>(
  page: Page,
  procedure: string,
  input: unknown,
  orgId: string,
): Promise<T> {
  // Only add ?input if the input is a non-empty object or non-undefined primitive
  const hasInput =
    input !== undefined &&
    input !== null &&
    !(typeof input === "object" && Object.keys(input as object).length === 0);

  const url = hasInput
    ? `${BASE_URL}/api/trpc/${procedure}?input=${encodeURIComponent(JSON.stringify(wrap(input)))}`
    : `${BASE_URL}/api/trpc/${procedure}`;

  const res = await page.request.get(url, {
    headers: { "x-organization-id": orgId },
  });
  const body = await res.json();
  if (!res.ok()) {
    const err = (body as Record<string, unknown>)["error"];
    throw new Error(
      `${procedure} failed: ${res.status()} ${JSON.stringify(err ?? body)}`,
    );
  }
  return unwrap(body) as T;
}

/** tRPC query via GET without input */
export async function trpcQueryNoInput<T = unknown>(
  page: Page,
  procedure: string,
): Promise<T> {
  const res = await page.request.get(`${BASE_URL}/api/trpc/${procedure}`);
  const body = await res.json();
  if (!res.ok()) {
    const err = (body as Record<string, unknown>)["error"];
    throw new Error(
      `${procedure} failed: ${res.status()} ${JSON.stringify(err ?? body)}`,
    );
  }
  return unwrap(body) as T;
}
