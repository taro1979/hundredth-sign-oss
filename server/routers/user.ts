import bcrypt from "bcrypt";
import { nanoid } from "nanoid";
import { z } from "zod";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import {
  createMembership,
  getOrganizationsByUser,
  getUserByEmail,
  listUsers,
  updateMembershipRole,
  updateUser,
  updateUserProfile,
  upsertUser,
} from "../db";
import { nameSchema, phoneSchema, signatureFontSchema } from "@shared/validation";
import { resolveUiLocale } from "@shared/locales";
import { buildStaffInvitationEmail, sendEmail } from "../email";
import { ENV } from "../_core/env";

const BCRYPT_ROUNDS = 12;
const passwordSchema = z.string().min(10).max(200);
const staffRoleSchema = z.enum(["admin", "member"]);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function localOpenId(email: string) {
  return `local:${email}`;
}

function requestBaseUrl(ctx: { req: any }) {
  return ENV.appUrl || `${ctx.req.protocol}://${ctx.req.headers.host}`;
}

async function getPrimaryOrgForUser(userId: number) {
  const orgs = await getOrganizationsByUser(userId);
  return orgs[0]?.org;
}

export const userRouter = router({
  profile: protectedProcedure.query(async ({ ctx }) => {
    return ctx.user;
  }),

  updateProfile: protectedProcedure
    .input(z.object({
      name: nameSchema.optional(),
      phone: phoneSchema.optional(),
      signatureFont: signatureFontSchema.optional(),
      signatureText: z.string().max(255).optional(),
      locale: z.string().max(10).optional().transform((value) => value ? resolveUiLocale(value) : undefined),
    }))
    .mutation(async ({ ctx, input }) => {
      await updateUserProfile(ctx.user.id, input);
      return { success: true };
    }),

  updateLocale: protectedProcedure
    .input(z.object({ locale: z.string().max(10).transform(resolveUiLocale) }))
    .mutation(async ({ ctx, input }) => {
      await updateUserProfile(ctx.user.id, { locale: input.locale });
      return { success: true, locale: input.locale };
    }),

  changePassword: protectedProcedure
    .input(z.object({
      currentPassword: z.string().min(1),
      newPassword: passwordSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.passwordHash || !(await bcrypt.compare(input.currentPassword, ctx.user.passwordHash))) {
        throw new Error("Current password is incorrect.");
      }
      await updateUser(ctx.user.id, {
        passwordHash: await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS),
        mustChangePassword: false,
      });
      return { success: true };
    }),

  listStaff: adminProcedure.query(async () => {
    return listUsers();
  }),

  createStaff: adminProcedure
    .input(z.object({
      email: z.string().email().max(320),
      name: z.string().min(1).max(255),
      staffRole: staffRoleSchema.default("member"),
    }))
    .mutation(async ({ ctx, input }) => {
      const email = normalizeEmail(input.email);
      const existing = await getUserByEmail(email);
      if (existing) {
        throw new Error("This email is already registered.");
      }

      const temporaryPassword = nanoid(18);
      await upsertUser({
        openId: localOpenId(email),
        email,
        name: input.name,
        passwordHash: await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS),
        staffRole: input.staffRole,
        isActive: true,
        mustChangePassword: true,
        loginMethod: "password",
      });

      const user = await getUserByEmail(email);
      const org = await getPrimaryOrgForUser(ctx.user.id);
      if (user && org) {
        await createMembership({
          userId: user.id,
          organizationId: org.id,
          role: input.staffRole === "admin" ? "manager" : "member",
        });
      }

      const emailBody = buildStaffInvitationEmail({
        email,
        name: input.name,
        temporaryPassword,
        loginUrl: `${requestBaseUrl(ctx)}/login`,
      });
      await sendEmail({
        to: email,
        toName: input.name,
        ...emailBody,
        type: "staff_invitation",
      });

      return { success: true, temporaryPassword };
    }),

  updateStaff: adminProcedure
    .input(z.object({
      userId: z.number().int().positive(),
      staffRole: staffRoleSchema.optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id && input.isActive === false) {
        throw new Error("You cannot disable your own account.");
      }

      const updates: { staffRole?: "admin" | "member"; isActive?: boolean } = {};
      if (input.staffRole !== undefined) updates.staffRole = input.staffRole;
      if (input.isActive !== undefined) updates.isActive = input.isActive;
      if (Object.keys(updates).length > 0) {
        await updateUser(input.userId, updates);
      }

      if (input.staffRole) {
        const org = await getPrimaryOrgForUser(ctx.user.id);
        const targetOrgs = await getOrganizationsByUser(input.userId);
        const targetMembership = targetOrgs.find(row => row.org.id === org?.id)?.membership;
        if (org && targetMembership) {
          await updateMembershipRole(
            targetMembership.id,
            input.staffRole === "admin" ? "manager" : "member",
            org.id,
          );
        }
      }

      return { success: true };
    }),

  resetStaffPassword: adminProcedure
    .input(z.object({ userId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const users = await listUsers();
      const target = users.find(user => user.id === input.userId);
      if (!target?.email) {
        throw new Error("User not found.");
      }

      const temporaryPassword = nanoid(18);
      await updateUser(input.userId, {
        passwordHash: await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS),
        mustChangePassword: true,
      });

      const emailBody = buildStaffInvitationEmail({
        email: target.email,
        name: target.name,
        temporaryPassword,
        loginUrl: `${requestBaseUrl(ctx)}/login`,
      });
      await sendEmail({
        to: target.email,
        toName: target.name ?? undefined,
        ...emailBody,
        type: "staff_invitation",
      });

      return { success: true, temporaryPassword };
    }),
});
