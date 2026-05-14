import bcrypt from "bcrypt";
import { createHash, randomBytes } from "crypto";
import { nanoid } from "nanoid";
import { z } from "zod";
import { COOKIE_NAME, SESSION_DURATION_MS } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { sdk } from "../_core/sdk";
import {
  createMembership,
  createOrganization,
  createPasswordResetToken,
  deleteExpiredPasswordResetTokens,
  getOrganizationsByUser,
  getPasswordResetTokenByHash,
  getUserByEmail,
  getUserById,
  getUserCount,
  markPasswordResetTokenUsed,
  updateUser,
  upsertUser,
} from "../db";
import { buildPasswordResetEmail, sendEmail } from "../email";
import { ENV } from "../_core/env";

const BCRYPT_ROUNDS = 12;
const passwordSchema = z.string().min(10).max(200);
const emailSchema = z.string().email().max(320).transform((value) => value.trim().toLowerCase());

function localOpenId(email: string) {
  return `local:${email}`;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

async function setSessionCookie(ctx: { req: any; res: any }, user: { openId: string; name?: string | null }) {
  const token = await sdk.createSessionToken(user.openId, {
    name: user.name || "",
    expiresInMs: SESSION_DURATION_MS,
  });
  ctx.res.cookie(COOKIE_NAME, token, {
    ...getSessionCookieOptions(ctx.req),
    maxAge: SESSION_DURATION_MS,
  });
}

async function ensureDefaultOrganization(userId: number, userName: string | null | undefined) {
  const existing = await getOrganizationsByUser(userId);
  if (existing.length > 0) return existing[0].org.id;

  const slug = `self-hosted-${nanoid(8)}`;
  const org = await createOrganization({
    name: "Hundredth Sign",
    slug,
    ownerUserId: userId,
    domain: null,
  });
  if (!org) throw new Error("Failed to create default organization.");
  await createMembership({
    userId,
    organizationId: org.id,
    role: "owner",
  });
  return org.id;
}

export const authRouter = router({
  me: publicProcedure.query((opts) => opts.ctx.user),

  setupStatus: publicProcedure.query(async () => ({
    needsSetup: (await getUserCount()) === 0,
  })),

  setupAdmin: publicProcedure
    .input(z.object({
      email: emailSchema,
      password: passwordSchema,
      name: z.string().min(1).max(255),
    }))
    .mutation(async ({ ctx, input }) => {
      if ((await getUserCount()) > 0) {
        throw new Error("Initial setup has already been completed.");
      }
      const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
      await upsertUser({
        openId: localOpenId(input.email),
        email: input.email,
        name: input.name,
        passwordHash,
        staffRole: "admin",
        isActive: true,
        mustChangePassword: false,
        isSuperAdmin: true,
        loginMethod: "password",
        lastSignedIn: new Date(),
      });
      const user = await getUserByEmail(input.email);
      if (!user) throw new Error("Failed to create admin user.");
      await ensureDefaultOrganization(user.id, user.name);
      await setSessionCookie(ctx, user);
      return { success: true };
    }),

  login: publicProcedure
    .input(z.object({ email: emailSchema, password: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const user = await getUserByEmail(input.email);
      if (!user || !user.isActive || !user.passwordHash || !(await bcrypt.compare(input.password, user.passwordHash))) {
        throw new Error("Invalid email or password.");
      }
      await updateUser(user.id, { lastSignedIn: new Date() });
      await ensureDefaultOrganization(user.id, user.name);
      await setSessionCookie(ctx, user);
      return { success: true, mustChangePassword: user.mustChangePassword };
    }),

  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),

  requestPasswordReset: publicProcedure
    .input(z.object({ email: emailSchema }))
    .mutation(async ({ ctx, input }) => {
      await deleteExpiredPasswordResetTokens();
      const user = await getUserByEmail(input.email);
      if (user?.isActive) {
        const token = randomBytes(32).toString("base64url");
        await createPasswordResetToken({
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        });
        const baseUrl = ENV.appUrl || `${ctx.req.protocol}://${ctx.req.headers.host}`;
        const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
        const email = buildPasswordResetEmail({ name: user.name, resetUrl });
        await sendEmail({
          to: user.email,
          toName: user.name ?? undefined,
          ...email,
          type: "password_reset",
        });
      }
      return { success: true };
    }),

  resetPassword: publicProcedure
    .input(z.object({ token: z.string().min(20), password: passwordSchema }))
    .mutation(async ({ input }) => {
      const record = await getPasswordResetTokenByHash(hashToken(input.token));
      if (!record || record.usedAt || record.expiresAt < new Date()) {
        throw new Error("Password reset link is invalid or expired.");
      }
      await updateUser(record.userId, {
        passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
        mustChangePassword: false,
      });
      await markPasswordResetTokenUsed(record.id);
      return { success: true };
    }),

  changePassword: protectedProcedure
    .input(z.object({ currentPassword: z.string().min(1), newPassword: passwordSchema }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.passwordHash || !(await bcrypt.compare(input.currentPassword, ctx.user.passwordHash))) {
        throw new Error("Current password is incorrect.");
      }
      await updateUser(ctx.user.id, {
        passwordHash: await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS),
        mustChangePassword: false,
      });
      const refreshed = await getUserById(ctx.user.id);
      return { success: true, user: refreshed ?? ctx.user };
    }),
});
