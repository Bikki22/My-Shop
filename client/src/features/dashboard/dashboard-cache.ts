import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import type { Fetcher } from "@/lib/query/fetcher";
import {
  getMyOverviewRequest,
  getMySalesRequest,
  getPlatformOverviewRequest,
  getPlatformRevenueRequest,
} from "./api/dashboard.api";
import type {
  AnalyticsRange,
  PlatformOverview,
  SalesSeries,
  VendorOverview,
} from "./types";

/**
 * The dashboards' cache contract: the keys, and the options built from them.
 *
 * Keys live here and nowhere else, for the same reason as `productCache`: a
 * server prefetch and a browser `useQuery` must agree on the key exactly, or
 * hydration silently misses and the browser refetches what the server just
 * sent.
 *
 * Every entry is keyed by range, so switching 30d → 7d → 30d returns to a
 * result already in memory instead of re-running four aggregations.
 */
export const dashboardCache = {
  /** Everything dashboard-shaped, for invalidating in one call. */
  all: ["dashboard"] as const,

  platformOverview: (range: AnalyticsRange) =>
    ["dashboard", "platform", "overview", range] as const,
  platformRevenue: (range: AnalyticsRange) =>
    ["dashboard", "platform", "revenue", range] as const,
  myOverview: (range: AnalyticsRange) =>
    ["dashboard", "me", "overview", range] as const,
  mySales: (range: AnalyticsRange) =>
    ["dashboard", "me", "sales", range] as const,

  platformOverviewOptions: (fetcher: Fetcher, range: AnalyticsRange) =>
    queryOptions({
      queryKey: dashboardCache.platformOverview(range),
      queryFn: () => {
        const { path, ...options } = getPlatformOverviewRequest(range);
        return fetcher<PlatformOverview>(path, options);
      },
      /**
       * Changing the range keeps the current numbers on screen while the new
       * ones load, rather than collapsing every stat card to a skeleton. The
       * cards dim via `isPlaceholderData` so it reads as "catching up".
       */
      placeholderData: keepPreviousData,
    }),

  platformRevenueOptions: (fetcher: Fetcher, range: AnalyticsRange) =>
    queryOptions({
      queryKey: dashboardCache.platformRevenue(range),
      queryFn: () => {
        const { path, ...options } = getPlatformRevenueRequest(range);
        return fetcher<SalesSeries>(path, options);
      },
      placeholderData: keepPreviousData,
    }),

  myOverviewOptions: (fetcher: Fetcher, range: AnalyticsRange) =>
    queryOptions({
      queryKey: dashboardCache.myOverview(range),
      queryFn: () => {
        const { path, ...options } = getMyOverviewRequest(range);
        return fetcher<VendorOverview>(path, options);
      },
      placeholderData: keepPreviousData,
    }),

  mySalesOptions: (fetcher: Fetcher, range: AnalyticsRange) =>
    queryOptions({
      queryKey: dashboardCache.mySales(range),
      queryFn: () => {
        const { path, ...options } = getMySalesRequest(range);
        return fetcher<SalesSeries>(path, options);
      },
      placeholderData: keepPreviousData,
    }),
} as const;
