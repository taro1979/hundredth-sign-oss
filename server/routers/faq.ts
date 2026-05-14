import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getPublishedFaqs, createFaq, updateFaq, deleteFaq, createInquiry, getInquiries, updateInquiryStatus } from "../db";
import { createInquirySchema } from "@shared/validation";

export const faqRouter = router({
  list: publicProcedure.query(async () => {
    return getPublishedFaqs();
  }),

  create: protectedProcedure
    .input(z.object({
      question: z.string().min(1, "質問は必須です"),
      answer: z.string().min(1, "回答は必須です"),
      category: z.string().max(100).optional(),
      order: z.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.isSuperAdmin) {
        throw new TRPCError({ code: "FORBIDDEN", message: "errors.auth.adminRequired" });
      }
      const id = await createFaq({
        question: input.question,
        answer: input.answer,
        category: input.category ?? null,
        order: input.order ?? 0,
      });
      return { id };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      question: z.string().optional(),
      answer: z.string().optional(),
      category: z.string().optional(),
      order: z.number().optional(),
      isPublished: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.isSuperAdmin) {
        throw new TRPCError({ code: "FORBIDDEN", message: "errors.auth.adminRequired" });
      }
      const { id, ...data } = input;
      await updateFaq(id, data);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.isSuperAdmin) {
        throw new TRPCError({ code: "FORBIDDEN", message: "errors.auth.adminRequired" });
      }
      await deleteFaq(input.id);
      return { success: true };
    }),
});

export const inquiryRouter = router({
  submit: publicProcedure
    .input(createInquirySchema)
    .mutation(async ({ input }) => {
      const id = await createInquiry({
        name: input.name,
        email: input.email,
        company: input.company || null,
        phone: input.phone || null,
        subject: input.subject,
        message: input.message,
      });
      await notifyOwnerOfInquiry(input.name, input.subject);
      return { id, success: true };
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user.isSuperAdmin) {
      throw new TRPCError({ code: "FORBIDDEN", message: "errors.auth.adminRequired" });
    }
    return getInquiries();
  }),

  updateStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["new", "read", "replied", "closed"]),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.isSuperAdmin) {
        throw new TRPCError({ code: "FORBIDDEN", message: "errors.auth.adminRequired" });
      }
      await updateInquiryStatus(input.id, input.status);
      return { success: true };
    }),
});

async function notifyOwnerOfInquiry(name: string, subject: string) {
  try {
    await import("../_core/notification").then(m =>
      m.notifyOwner({
        title: `新しいお問い合わせ: ${subject}`,
        content: `${name}さんからお問い合わせがありました。\n件名: ${subject}`,
      })
    );
  } catch {
    // Non-critical, ignore
  }
}
