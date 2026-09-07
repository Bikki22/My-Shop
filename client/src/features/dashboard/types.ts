/**
 * Mirrors the payloads of `modules/admin/` on the server as they arrive over
 * the wire: every `Date` is an ISO string.
 *
 * The module is read-only — it owns no collection and aggregates over
 * sub-orders, vendors, products and users. Two surfaces share one shape
 * vocabulary: the platform's numbers (`/admin/overview`, `/admin/revenue`)
 * and one shop's own (`/admin/me/overview`, `/admin/me/sales`).
 *
 * The definitions behind these figures are not obvious and are the server's
 * to own — `server/docs/integrations.md` states them. The three worth
 * knowing before rendering any of it:
 *
 * - `gmv` is merchandise only, before delivery and tax. `shipping`, `tax`
 *   and `discount` come back alongside, so a gross-receipts figure is the
 *   caller's to add up.
 * - A sale is any sub-order that is not cancelled — *not* only paid ones.
 *   Cash on delivery is paid at the door, so filtering on payment would
 *   erase most of the marketplace's revenue.
 * - `orders` counts distinct customer baskets and `subOrders` counts vendor
 *   parcels; a basket split across three shops is one order and three
 *   sub-orders.
 */

import type { OrderStatus } from "@/features/orders/types";
import type { VendorStatus } from "@/features/vendors/types";

/** The presets the range picker offers. Mirrors `ANALYTICS_RANGES`. */
export const ANALYTICS_RANGES = ["7d", "30d", "90d", "365d"] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

export const ANALYTICS_INTERVALS = ["day", "month"] as const;
export type AnalyticsInterval = (typeof ANALYTICS_INTERVALS)[number];

/** Human labels for the range chips. */
export const RANGE_LABELS: Record<AnalyticsRange, string> = {
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
  "365d": "12 months",
};

/**
 * The window the server resolved the request to.
 *
 * `to` is **exclusive** — midnight after the last day — and `timezone` is
 * the zone the whole thing was measured in (`ANALYTICS_TIMEZONE`, default
 * `Asia/Kathmandu`). Both are echoed back so the UI can label a chart with
 * the days the server actually used rather than the ones it asked for.
 */
export interface ResolvedRange {
  from: string;
  to: string;
  days: number;
  timezone: string;
}

export interface SalesTotals {
  gmv: number;
  shipping: number;
  tax: number;
  discount: number;
  commission: number;
  vendorEarnings: number;
  orders: number;
  subOrders: number;
  units: number;
  averageOrderValue: number;
}

/** One bucket of the timeseries. `date` is `YYYY-MM-DD` or `YYYY-MM`. */
export interface SeriesPoint extends Omit<SalesTotals, "averageOrderValue"> {
  date: string;
}

/**
 * Money by where each sale has got to on its way to a bank.
 *
 * All-time rather than windowed, deliberately: "what do we owe?" is a
 * question about now, and a 30-day window would hide the oldest debts.
 */
export interface PayoutTotals {
  pending: number;
  payable: number;
  processing: number;
  paid: number;
  reversed: number;
}

/** The statuses a parcel can still be acted on from. */
export const OPEN_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
] as const;
export type OpenStatus = (typeof OPEN_STATUSES)[number];

export type FulfilmentCounts = Record<OpenStatus, number>;

/** `outOfStock` and `lowStock` never overlap — zero stock is its own case. */
export interface CatalogueCounts {
  products: number;
  outOfStock: number;
  lowStock: number;
}

export type VendorCounts = Record<Lowercase<VendorStatus>, number> & {
  total: number;
};

export interface PlatformOverview {
  range: ResolvedRange;
  sales: SalesTotals;
  today: SalesTotals;
  vendors: VendorCounts;
  customers: { total: number; newInRange: number };
  catalogue: CatalogueCounts;
  payouts: PayoutTotals;
  fulfilment: FulfilmentCounts;
}

export interface VendorOverview {
  range: ResolvedRange;
  vendor: { id: string; name: string; slug: string; status: VendorStatus };
  sales: SalesTotals;
  today: SalesTotals;
  payouts: PayoutTotals;
  catalogue: CatalogueCounts;
  fulfilment: FulfilmentCounts;
}

export interface SalesSeries {
  range: ResolvedRange;
  interval: AnalyticsInterval;
  points: SeriesPoint[];
}

/** The query both dashboards are driven by, as the UI thinks about it. */
export interface AnalyticsFilters {
  range: AnalyticsRange;
}

/** Re-exported so dashboard components need one import for their labels. */
export type { OrderStatus };
