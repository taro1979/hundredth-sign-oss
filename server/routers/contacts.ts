import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { orgProcedure, router } from "../_core/trpc";
import {
  getContactsByOrg, getContactById, createContact, updateContact, deleteContact,
  getGroupsForContact,
  getCategoriesByOrg, createCategory, updateCategory, deleteCategory,
  getGroupsByOrg, createGroup, updateGroup, deleteGroup,
  getGroupMembers, addContactToGroup, removeContactFromGroup, getContactsByGroup,
} from "../db";
import {
  emailSchema, nameSchema, phoneSchema, companySchema, createContactSchema,
} from "@shared/validation";

export const contactsRouter = router({
  list: orgProcedure.query(async ({ ctx }) => {
    const orgId = (ctx as any).org.organizationId as number;
    const contactList = await getContactsByOrg(orgId);
    const enriched = await Promise.all(
      contactList.map(async (c) => {
        const groups = await getGroupsForContact(c.id);
        return { ...c, groups: groups.map(g => ({ id: g.groupId, name: g.groupName })) };
      })
    );
    return enriched;
  }),

  create: orgProcedure
    .input(createContactSchema)
    .mutation(async ({ ctx, input }) => {
      const orgId = (ctx as any).org.organizationId as number;
      const id = await createContact({
        userId: ctx.user!.id,
        organizationId: orgId,
        name: input.name,
        email: input.email,
        company: input.company || null,
        department: input.department || null,
        phone: input.phone || null,
        notes: input.notes || null,
        category: input.category || null,
      });
      return { id };
    }),

  update: orgProcedure
    .input(z.object({
      id: z.number(),
      name: nameSchema.optional(),
      email: emailSchema.optional(),
      company: companySchema.optional(),
      department: z.string().max(255).optional(),
      phone: phoneSchema.optional(),
      notes: z.string().max(1000).optional(),
      category: z.string().max(50).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = (ctx as any).org.organizationId as number;
      const contact = await getContactById(input.id);
      if (!contact || contact.organizationId !== orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "errors.contacts.notFound" });
      }
      const { id, ...data } = input;
      await updateContact(id, data);
      return { success: true };
    }),

  delete: orgProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = (ctx as any).org.organizationId as number;
      const contact = await getContactById(input.id);
      if (!contact || contact.organizationId !== orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "errors.contacts.notFound" });
      }
      await deleteContact(input.id);
      return { success: true };
    }),
});

export const contactCategoriesRouter = router({
  list: orgProcedure.query(async ({ ctx }) => {
    const orgId = (ctx as any).org.organizationId as number;
    return getCategoriesByOrg(orgId);
  }),

  create: orgProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      color: z.string().max(20).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = (ctx as any).org.organizationId as number;
      const result = await createCategory({
        userId: ctx.user!.id,
        organizationId: orgId,
        name: input.name,
        color: input.color || null,
      });
      return result;
    }),

  update: orgProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(100).optional(),
      color: z.string().max(20).optional(),
      order: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = (ctx as any).org.organizationId as number;
      const categories = await getCategoriesByOrg(orgId);
      const cat = categories.find(c => c.id === input.id);
      if (!cat) throw new TRPCError({ code: "NOT_FOUND", message: "errors.categories.notFound" });
      const { id, ...data } = input;
      await updateCategory(id, data);
      return { success: true };
    }),

  delete: orgProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = (ctx as any).org.organizationId as number;
      const categories = await getCategoriesByOrg(orgId);
      const cat = categories.find(c => c.id === input.id);
      if (!cat) throw new TRPCError({ code: "NOT_FOUND", message: "errors.categories.notFound" });
      await deleteCategory(input.id);
      return { success: true };
    }),
});

export const contactGroupsRouter = router({
  list: orgProcedure.query(async ({ ctx }) => {
    const orgId = (ctx as any).org.organizationId as number;
    return getGroupsByOrg(orgId);
  }),

  create: orgProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      description: z.string().max(1000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = (ctx as any).org.organizationId as number;
      const result = await createGroup({
        userId: ctx.user!.id,
        organizationId: orgId,
        name: input.name,
        description: input.description || null,
      });
      return result;
    }),

  update: orgProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(255).optional(),
      description: z.string().max(1000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = (ctx as any).org.organizationId as number;
      const groups = await getGroupsByOrg(orgId);
      const grp = groups.find(g => g.id === input.id);
      if (!grp) throw new TRPCError({ code: "NOT_FOUND", message: "errors.groups.notFound" });
      const { id, ...data } = input;
      await updateGroup(id, data);
      return { success: true };
    }),

  delete: orgProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = (ctx as any).org.organizationId as number;
      const groups = await getGroupsByOrg(orgId);
      const grp = groups.find(g => g.id === input.id);
      if (!grp) throw new TRPCError({ code: "NOT_FOUND", message: "errors.groups.notFound" });
      await deleteGroup(input.id);
      return { success: true };
    }),

  members: orgProcedure
    .input(z.object({ groupId: z.number() }))
    .query(async ({ ctx, input }) => {
      const orgId = (ctx as any).org.organizationId as number;
      const groups = await getGroupsByOrg(orgId);
      const grp = groups.find(g => g.id === input.groupId);
      if (!grp) throw new TRPCError({ code: "NOT_FOUND", message: "errors.groups.notFound" });
      return getGroupMembers(input.groupId);
    }),

  addMember: orgProcedure
    .input(z.object({ groupId: z.number(), contactId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = (ctx as any).org.organizationId as number;
      const groups = await getGroupsByOrg(orgId);
      const grp = groups.find(g => g.id === input.groupId);
      if (!grp) throw new TRPCError({ code: "NOT_FOUND", message: "errors.groups.notFound" });
      const contact = await getContactById(input.contactId);
      if (!contact || contact.organizationId !== orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "errors.contacts.notFound" });
      }
      return addContactToGroup(input.contactId, input.groupId);
    }),

  removeMember: orgProcedure
    .input(z.object({ groupId: z.number(), contactId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = (ctx as any).org.organizationId as number;
      const groups = await getGroupsByOrg(orgId);
      const grp = groups.find(g => g.id === input.groupId);
      if (!grp) throw new TRPCError({ code: "NOT_FOUND", message: "errors.groups.notFound" });
      const contact = await getContactById(input.contactId);
      if (!contact || contact.organizationId !== orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "errors.contacts.notFound" });
      }
      await removeContactFromGroup(input.contactId, input.groupId);
      return { success: true };
    }),

  contacts: orgProcedure
    .input(z.object({ groupId: z.number() }))
    .query(async ({ ctx, input }) => {
      const orgId = (ctx as any).org.organizationId as number;
      const groups = await getGroupsByOrg(orgId);
      const grp = groups.find(g => g.id === input.groupId);
      if (!grp) throw new TRPCError({ code: "NOT_FOUND", message: "errors.groups.notFound" });
      return getContactsByGroup(input.groupId);
    }),
});
