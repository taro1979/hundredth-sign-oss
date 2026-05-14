import { UNAUTHED_ERR_MSG } from "@shared/const";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import {
  getMembership,
  getActiveAllowedIps,
  getOrganizationsByUser,
} from "../db";
import { getClientIp } from "../clientIp";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

// ── requireUser middleware ──
const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: { ...ctx, user: ctx.user },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }
    if (!ctx.user.isSuperAdmin && ctx.user.staffRole !== "admin") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "errors.auth.adminRequired",
      });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  })
);

// ── SuperAdmin procedure (system-level, separate from org roles) ──
export const superAdminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    if (!ctx.user || !ctx.user.isSuperAdmin) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "errors.auth.adminRequired",
      });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  })
);

// ── Internal workspace context middleware ──
// Uses x-organization-id when present, otherwise falls back to the user's single workspace.
const requireOrgContext = t.middleware(async opts => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  const orgIdHeader = ctx.req.headers["x-organization-id"];
  let orgId: number | undefined;

  if (typeof orgIdHeader === "string" && orgIdHeader.length > 0) {
    const parsed = parseInt(orgIdHeader, 10);
    if (isNaN(parsed)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "errors.auth.invalidOrgId",
      });
    }
    orgId = parsed;
  } else {
    const orgs = await getOrganizationsByUser(ctx.user.id);
    orgId = orgs[0]?.org.id;
  }

  if (!orgId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "errors.auth.orgHeaderRequired",
    });
  }

  const membership = await getMembership(ctx.user.id, orgId);
  if (!membership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "errors.auth.notOrgMember",
    });
  }

  // ── IP restriction check ──
  const activeIps = await getActiveAllowedIps(orgId);
  if (activeIps && activeIps.length > 0) {
    const clientIp = getClientIp(ctx.req);
    const isAllowed =
      clientIp !== null &&
      activeIps.some(entry => entry.ipAddress === clientIp);
    if (!isAllowed) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "errors.auth.ipRestricted",
      });
    }
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      org: {
        organizationId: orgId,
        membership,
      },
    },
  });
});

/**
 * orgProcedure - requires authenticated user + valid org membership (any role)
 * ctx.org.organizationId and ctx.org.membership are available
 */
export const orgProcedure = t.procedure.use(requireOrgContext);

/**
 * orgManagerProcedure - requires org membership with owner or manager role
 */
export const orgManagerProcedure = orgProcedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    const orgCtx = (ctx as any).org as {
      organizationId: number;
      membership: { role: string };
    };
    if (!orgCtx || !["owner", "manager"].includes(orgCtx.membership.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "errors.auth.managerRequired",
      });
    }
    return next({ ctx: { ...ctx, user: (ctx as any).user } });
  })
);

/**
 * orgOwnerProcedure - legacy name for administrator-only workspace settings.
 * OSS exposes staff roles as admin/member; the older membership owner value is
 * still accepted for the initial setup account and migration compatibility.
 */
export const orgOwnerProcedure = orgProcedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    const orgCtx = (ctx as any).org as {
      organizationId: number;
      membership: { role: string };
    };
    const user = (ctx as any).user;
    const isAdminStaff = Boolean(
      user?.isSuperAdmin || user?.staffRole === "admin"
    );
    if (!orgCtx || (!isAdminStaff && orgCtx.membership.role !== "owner")) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "errors.auth.ownerRequired",
      });
    }
    return next({ ctx: { ...ctx, user } });
  })
);
