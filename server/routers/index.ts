import { router } from "../_core/trpc";
import { systemRouter } from "../_core/systemRouter";
import { authRouter } from "./auth";
import { userRouter } from "./user";
import { documentsRouter } from "./documents";
import { signatureRouter } from "./signature";
import { contactsRouter, contactCategoriesRouter, contactGroupsRouter } from "./contacts";
import { templatesRouter } from "./templates";
import { faqRouter, inquiryRouter } from "./faq";
import { dashboardRouter } from "./dashboard";
import { internalApprovalRouter } from "./internalApproval";
import { organizationRouter } from "./organization";
import { auditLogRouter } from "./auditLog";
import { inboxRouter } from "./inbox";

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  user: userRouter,
  documents: documentsRouter,
  signature: signatureRouter,
  contacts: contactsRouter,
  contactCategories: contactCategoriesRouter,
  contactGroups: contactGroupsRouter,
  templates: templatesRouter,
  faq: faqRouter,
  inquiry: inquiryRouter,
  dashboard: dashboardRouter,
  inbox: inboxRouter,
  internalApproval: internalApprovalRouter,
  organization: organizationRouter,
  auditLog: auditLogRouter,
});

export type AppRouter = typeof appRouter;
