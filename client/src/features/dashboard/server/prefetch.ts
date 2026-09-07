import "server-only";

import type { QueryClient } from "@tanstack/react-query";
import { serverApi } from "@/lib/api/server";
import { dashboardCache } from "../dashboard-cache";
import type { AnalyticsRange } from "../types";

/**
 * Fills the query cache with a dashboard's data, server-side.
 *
 * Awaited rather than dehydrated as a pending query, for the reason
 * `prefetchProducts` documents: a pending query that rejects surfaces as a
 * client-side render error instead of the component's own "unavailable"
 * panel. `prefetchQuery` resolves either way — a rejection leaves the query
 * in an error state, which is not dehydrated, so the browser retries and the
 * dashboard reports the failure itself.
 *
 * `queryFn` comes from `dashboardCache` with `serverApi` substituted for the
 * browser's fetcher (a hook bound to `useAuth()`, which cannot run here).
 * Only the function differs — the **key** is shared, which is what makes
 * hydration line up.
 *
 * The two reads run concurrently: the chart's aggregation is the slower of
 * the pair and there is no reason to wait for the counters first.
 */
export async function prefetchPlatformDashboard(
  queryClient: QueryClient,
  range: AnalyticsRange,
): Promise<void> {
  await Promise.all([
    queryClient.prefetchQuery(
      dashboardCache.platformOverviewOptions(serverApi, range),
    ),
    queryClient.prefetchQuery(
      dashboardCache.platformRevenueOptions(serverApi, range),
    ),
  ]);
}

export async function prefetchSellerDashboard(
  queryClient: QueryClient,
  range: AnalyticsRange,
): Promise<void> {
  await Promise.all([
    queryClient.prefetchQuery(
      dashboardCache.myOverviewOptions(serverApi, range),
    ),
    queryClient.prefetchQuery(dashboardCache.mySalesOptions(serverApi, range)),
  ]);
}
