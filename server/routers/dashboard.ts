import { orgProcedure, router } from "../_core/trpc";
import { getDashboardStatsByOrg, getRecentActivityByOrg } from "../db";

export const dashboardRouter = router({
  stats: orgProcedure.query(async ({ ctx }) => {
    const orgId = (ctx as any).org.organizationId as number;
    return getDashboardStatsByOrg(orgId);
  }),

  recentActivity: orgProcedure.query(async ({ ctx }) => {
    const orgId = (ctx as any).org.organizationId as number;
    return getRecentActivityByOrg(orgId);
  }),
});
