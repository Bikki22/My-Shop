import type { RequestOptions } from "@/lib/api";
import type { AnalyticsInterval, AnalyticsRange } from "../types";

/**
 * Endpoint paths for the server's `/api/v1/admin` router.
 *
 * The `/me` pair is the same aggregation scoped to the caller's own shop —
 * note there is no shop id in the path. The server resolves it from the
 * session, so a merchant cannot address anyone else's numbers.
 */
export const dashboardEndpoints = {
  overview: "/admin/overview",
  revenue: "/admin/revenue",
  myOverview: "/admin/me/overview",
  mySales: "/admin/me/sales",
} as const;

type Request = { path: string } & RequestOptions;

/**
 * These endpoints answer with the `{ success, data }` envelope, so the
 * default unwrapping is right and no `unwrap: false` is needed — unlike the
 * catalogue's list, which spreads a page envelope onto the body.
 */
export const getPlatformOverviewRequest = (range: AnalyticsRange): Request => ({
  path: dashboardEndpoints.overview,
  method: "GET",
  searchParams: { range },
});

export const getPlatformRevenueRequest = (
  range: AnalyticsRange,
  interval?: AnalyticsInterval,
): Request => ({
  path: dashboardEndpoints.revenue,
  method: "GET",
  // `interval` is omitted rather than defaulted: the server picks day or
  // month from the resolved span, and hardcoding one here would give a year
  // 365 unreadable points.
  searchParams: { range, interval },
});

export const getMyOverviewRequest = (range: AnalyticsRange): Request => ({
  path: dashboardEndpoints.myOverview,
  method: "GET",
  searchParams: { range },
});

export const getMySalesRequest = (
  range: AnalyticsRange,
  interval?: AnalyticsInterval,
): Request => ({
  path: dashboardEndpoints.mySales,
  method: "GET",
  searchParams: { range, interval },
});
