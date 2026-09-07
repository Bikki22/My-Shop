"use client";

import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api/client";
import { dashboardCache } from "../dashboard-cache";
import type { AnalyticsRange } from "../types";

/**
 * The four dashboard reads, from the shared client cache.
 *
 * The range still comes from the URL — that is what makes a dashboard state
 * shareable and reload-safe, and it is why the pages also render on the
 * server. What the cache adds is the transition: a range the operator has
 * already looked at renders from memory on the same frame, and a new one
 * keeps the previous figures on screen (`placeholderData`) instead of
 * blanking the whole grid.
 *
 * Each is its own query rather than one combined read, so the chart can
 * still be loading while the stat cards are already painted.
 */

export function usePlatformOverview(range: AnalyticsRange) {
  const api = useApi();
  return useQuery(dashboardCache.platformOverviewOptions(api, range));
}

export function usePlatformRevenue(range: AnalyticsRange) {
  const api = useApi();
  return useQuery(dashboardCache.platformRevenueOptions(api, range));
}

export function useMyOverview(range: AnalyticsRange) {
  const api = useApi();
  return useQuery(dashboardCache.myOverviewOptions(api, range));
}

export function useMySales(range: AnalyticsRange) {
  const api = useApi();
  return useQuery(dashboardCache.mySalesOptions(api, range));
}
