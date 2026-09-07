import type { QueryFilter } from "mongoose";
import { env } from "../../config/env.js";
import { ApiError } from "../../utils/ApiError.js";
import { money, NOT_DELETED } from "../../utils/mongo.js";
import type { OrderStatus } from "../orders/order.model.js";
import {
  PAYOUT_STATES,
  SubOrder,
  type ISubOrder,
  type PayoutState,
} from "../orders/sub-order.model.js";
import {
  LOW_STOCK_THRESHOLD,
  Product,
  type IProduct,
} from "../products/product.model.js";
import { User, type IUser, type IUserDocument } from "../users/user.model.js";
import {
  VENDOR_STATUSES,
  Vendor,
  type VendorDocument,
  type VendorStatus,
} from "../vendors/vendor.model.js";
import {
  RANGE_DAYS,
  type AnalyticsInterval,
  type AnalyticsRange,
  type OverviewQuery,
  type TimeseriesQuery,
} from "./admin.validation.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The one zone every figure on every dashboard is measured in. Read once,
 * because a request that resolved its range in one zone and bucketed its
 * chart in another would draw a chart whose bars do not add up to the stat
 * card above them.
 */
const TIMEZONE = env.ANALYTICS_TIMEZONE;

// ---------- Time ----------
//
// Everything in this section exists because a calendar day is not 24 hours
// from an arbitrary instant, and Nepal's UTC+05:45 makes that unusually
// visible: bucketing in UTC files every order placed after 18:15 local
// under the previous day.

/** `en-CA` renders dates as `YYYY-MM-DD`, which also sorts chronologically. */
const DAY_KEY_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
});

const ZONED_PARTS_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  // `hourCycle: "h23"` and not `hour12: false`: the latter renders midnight
  // as "24" on some ICU builds, which parses back as the following day.
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

type ZonedParts = Record<
  "year" | "month" | "day" | "hour" | "minute" | "second",
  string
>;

const zonedPartsOf = (at: Date): ZonedParts => {
  const parts: Partial<ZonedParts> = {};
  for (const { type, value } of ZONED_PARTS_FORMAT.formatToParts(at)) {
    if (type !== "literal") {
      parts[type as keyof ZonedParts] = value;
    }
  }
  // Every one of the six is requested explicitly above, so all six are here.
  return parts as ZonedParts;
};

/** The calendar day `at` falls on, in the analytics zone. */
const dayKey = (at: Date): string => DAY_KEY_FORMAT.format(at);

/**
 * How far the analytics zone runs ahead of UTC at `at`, in milliseconds.
 *
 * Measured rather than hardcoded: rendering the instant in the zone and
 * reading the result back as though it were UTC leaves exactly the offset
 * as the difference. That keeps working if the deployment changes zone or
 * a zone's rules change — neither of which a constant would survive.
 */
const offsetMsAt = (at: Date): number => {
  const p = zonedPartsOf(at);
  const asIfUtc = Date.parse(
    `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`,
  );
  // `at`'s own milliseconds are subtracted out because the rendered side
  // has none — `formatToParts` stops at seconds. Leaving them in would
  // shift every computed midnight by however many milliseconds into the
  // second the request happened to arrive, making the range boundaries
  // differ from one call to the next.
  return asIfUtc - (at.getTime() - at.getMilliseconds());
};

/** The instant midnight begins, in the analytics zone, on `at`'s day. */
const startOfDay = (at: Date): Date => {
  const midnightAsIfUtc = Date.parse(`${dayKey(at)}T00:00:00Z`);
  // The offset is sampled at `at` rather than at the midnight being solved
  // for. The two differ only within the hour a DST transition lands on;
  // Nepal has no DST, and a dashboard bucket does not warrant iterating to
  // a fixed point.
  return new Date(midnightAsIfUtc - offsetMsAt(at));
};

/**
 * Midnight, in the analytics zone, on the day after `at`.
 *
 * Stepping 36 hours and re-truncating rather than adding exactly 24: from a
 * midnight, 36 hours lands near midday the following day, which is the
 * right day however far a DST shift moves it.
 */
const startOfNextDay = (at: Date): Date =>
  startOfDay(new Date(startOfDay(at).getTime() + 36 * 60 * 60 * 1000));

/**
 * The window a request asked for.
 *
 * Half-open on purpose — `to` is the midnight *after* the last day, so
 * every filter reads `$gte from, $lt to` and an order placed at
 * 23:59:59.999 on the final day cannot fall outside the range it belongs
 * to.
 */
export interface ResolvedRange {
  from: Date;
  to: Date;
  days: number;
  timezone: string;
}

/**
 * A bare `YYYY-MM-DD` anchored inside the day it names.
 *
 * Noon UTC, not midnight: `2026-09-01T00:00:00Z` is still 31 August in any
 * zone behind UTC, so truncating that would silently shift the whole report
 * by a day. Midday is more than 12 hours from either edge, so it lands on
 * the intended date in every real zone.
 */
const anchorOf = (isoDate: string): Date => new Date(`${isoDate}T12:00:00Z`);

interface RangeRequest {
  range: AnalyticsRange;
  from?: string | undefined;
  to?: string | undefined;
}

const resolveRange = ({ range, from, to }: RangeRequest): ResolvedRange => {
  // Validation guarantees these arrive together, in order, and within the
  // span cap — so an explicit window needs no further checking here.
  if (from !== undefined && to !== undefined) {
    const start = startOfDay(anchorOf(from));
    const end = startOfNextDay(anchorOf(to));
    return {
      from: start,
      to: end,
      days: Math.round((end.getTime() - start.getTime()) / MS_PER_DAY),
      timezone: TIMEZONE,
    };
  }

  const now = new Date();
  const days = RANGE_DAYS[range];
  const end = startOfNextDay(now);
  // Counted back from *today's* midnight, so "7d" means this day plus the
  // six before it rather than a 7×24h window ending mid-afternoon.
  const start = startOfDay(
    new Date(startOfDay(now).getTime() - (days - 1) * MS_PER_DAY),
  );

  return { from: start, to: end, days, timezone: TIMEZONE };
};

/**
 * Every bucket key the range covers, including the ones no order landed in.
 *
 * A chart drawn only from the rows Mongo returned skips its quiet days
 * entirely, which slides every later point left and turns a flat week into
 * a rising one. Filling the gaps here is what keeps the x-axis honest.
 */
const bucketKeys = (
  range: ResolvedRange,
  interval: AnalyticsInterval,
): string[] => {
  const keys: string[] = [];
  const seen = new Set<string>();

  for (
    let cursor = range.from;
    cursor < range.to;
    cursor = startOfNextDay(cursor)
  ) {
    const day = dayKey(cursor);
    const key = interval === "day" ? day : day.slice(0, 7);
    if (!seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
  }

  return keys;
};

// ---------- Reported shapes ----------

/**
 * What a set of sub-orders adds up to.
 *
 * `gmv` is merchandise only — the goods subtotal, before delivery and tax.
 * That is the figure a marketplace is measured on: shipping is a courier's
 * money passing through and tax is the state's, so counting either would
 * flatter the number without selling anything. `commission` is what the
 * platform earns from those same sales and `vendorEarnings` what the shops
 * do; all three are reported together because GMV alone tells an operator
 * nothing about the business underneath it.
 */
export interface SalesTotals {
  gmv: number;
  shipping: number;
  tax: number;
  discount: number;
  commission: number;
  vendorEarnings: number;
  /** Distinct customer orders — one split across three shops counts once. */
  orders: number;
  /** Vendor parcels; always ≥ `orders`. */
  subOrders: number;
  units: number;
  averageOrderValue: number;
}

export interface SeriesPoint extends Omit<SalesTotals, "averageOrderValue"> {
  /** `YYYY-MM-DD`, or `YYYY-MM` when the interval is monthly. */
  date: string;
}

/** Money broken out by where each sale has got to on its way to a bank. */
export type PayoutTotals = Record<Lowercase<PayoutState>, number>;

/** The statuses a parcel can still be acted on from — the open worklist. */
export const OPEN_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
] as const satisfies readonly OrderStatus[];

export type OpenStatus = (typeof OPEN_STATUSES)[number];

export type VendorCounts = Record<Lowercase<VendorStatus>, number> & {
  total: number;
};

export interface CatalogueCounts {
  products: number;
  outOfStock: number;
  lowStock: number;
}

export interface PlatformOverview {
  range: ResolvedRange;
  sales: SalesTotals;
  today: SalesTotals;
  vendors: VendorCounts;
  customers: { total: number; newInRange: number };
  catalogue: CatalogueCounts;
  payouts: PayoutTotals;
  fulfilment: Record<OpenStatus, number>;
}

export interface VendorOverview {
  range: ResolvedRange;
  vendor: { id: string; name: string; slug: string; status: VendorStatus };
  sales: SalesTotals;
  today: SalesTotals;
  payouts: PayoutTotals;
  catalogue: CatalogueCounts;
  fulfilment: Record<OpenStatus, number>;
}

export interface SalesSeries {
  range: ResolvedRange;
  interval: AnalyticsInterval;
  points: SeriesPoint[];
}

// ---------- Raw aggregation rows ----------

interface RawSalesRow {
  gmv: number;
  shipping: number;
  tax: number;
  discount: number;
  commission: number;
  vendorEarnings: number;
  units: number;
  subOrders: number;
  orders: number;
}

interface RawSeriesRow extends RawSalesRow {
  date: string;
}

interface CountRow<T extends string> {
  _id: T;
  count: number;
}

interface PayoutRow {
  _id: PayoutState;
  amount: number;
}

const EMPTY_SALES: RawSalesRow = {
  gmv: 0,
  shipping: 0,
  tax: 0,
  discount: 0,
  commission: 0,
  vendorEarnings: 0,
  units: 0,
  subOrders: 0,
  orders: 0,
};

/**
 * Sales exclude cancelled parcels, and nothing else.
 *
 * Deliberately *not* narrowed to `paymentStatus: "PAID"`: cash on delivery
 * is paid at the door, so filtering on it would erase most of a Nepali
 * marketplace's revenue from its own dashboard. What has actually reached a
 * bank is a different question, and the `payouts` block answers it.
 */
const SOLD: QueryFilter<ISubOrder> = { status: { $ne: "CANCELLED" } };

export class AdminService {
  // ---------- Platform ----------

  async overview(query: OverviewQuery): Promise<PlatformOverview> {
    const range = resolveRange(query);
    const todayStart = startOfDay(new Date());

    const [sales, today, vendors, customers, catalogue, payouts, fulfilment] =
      await Promise.all([
        AdminService.salesTotals({
          ...SOLD,
          placedAt: { $gte: range.from, $lt: range.to },
        }),
        AdminService.salesTotals({ ...SOLD, placedAt: { $gte: todayStart } }),
        AdminService.vendorCounts(),
        AdminService.customerCounts(range),
        AdminService.catalogueCounts({}),
        AdminService.payoutTotals({}),
        AdminService.fulfilmentCounts({}),
      ]);

    return {
      range,
      sales,
      today,
      vendors,
      customers,
      catalogue,
      payouts,
      fulfilment,
    };
  }

  async revenue(query: TimeseriesQuery): Promise<SalesSeries> {
    const range = resolveRange(query);
    const interval = AdminService.intervalFor(query, range);

    const points = await AdminService.salesSeries(
      { ...SOLD, placedAt: { $gte: range.from, $lt: range.to } },
      interval,
      range,
    );

    return { range, interval, points };
  }

  // ---------- One shop, for the owner of that shop ----------

  async myOverview(
    user: IUserDocument,
    query: OverviewQuery,
  ): Promise<VendorOverview> {
    const shop = await AdminService.vendorOf(user);
    const range = resolveRange(query);
    const todayStart = startOfDay(new Date());
    const mine: QueryFilter<ISubOrder> = { vendor: shop._id };

    const [sales, today, payouts, catalogue, fulfilment] = await Promise.all([
      AdminService.salesTotals({
        ...mine,
        ...SOLD,
        placedAt: { $gte: range.from, $lt: range.to },
      }),
      AdminService.salesTotals({
        ...mine,
        ...SOLD,
        placedAt: { $gte: todayStart },
      }),
      AdminService.payoutTotals(mine),
      AdminService.catalogueCounts({ vendor: shop._id }),
      AdminService.fulfilmentCounts(mine),
    ]);

    return {
      range,
      vendor: {
        id: shop._id.toString(),
        name: shop.name,
        slug: shop.slug,
        status: shop.status,
      },
      sales,
      today,
      payouts,
      catalogue,
      fulfilment,
    };
  }

  async mySales(
    user: IUserDocument,
    query: TimeseriesQuery,
  ): Promise<SalesSeries> {
    const shop = await AdminService.vendorOf(user);
    const range = resolveRange(query);
    const interval = AdminService.intervalFor(query, range);

    const points = await AdminService.salesSeries(
      {
        vendor: shop._id,
        ...SOLD,
        placedAt: { $gte: range.from, $lt: range.to },
      },
      interval,
      range,
    );

    return { range, interval, points };
  }

  // ---------- Internals ----------

  /**
   * One resolution rule for every timeseries: the caller's explicit choice
   * wins, otherwise anything past a quarter is bucketed monthly. 365 daily
   * points is a chart nobody can read, and a week of monthly ones is a
   * single bar.
   */
  private static intervalFor(
    query: TimeseriesQuery,
    range: ResolvedRange,
  ): AnalyticsInterval {
    return query.interval ?? (range.days > 90 ? "month" : "day");
  }

  private static async vendorOf(user: IUserDocument): Promise<VendorDocument> {
    const shop = await Vendor.findOne({ owner: user._id, ...NOT_DELETED });
    if (!shop) {
      throw ApiError.forbidden("You do not have a seller account");
    }
    return shop;
  }

  /**
   * The accumulators every sales figure is built from.
   *
   * `orders` collects a *set* of parent ids rather than counting rows,
   * because one customer order becomes one sub-order per shop: counting
   * rows would report a three-shop basket as three orders and divide the
   * average order value by three.
   */
  private static readonly SALES_ACCUMULATORS = {
    gmv: { $sum: "$pricing.subtotal" },
    shipping: { $sum: "$pricing.shippingFee" },
    tax: { $sum: "$pricing.taxTotal" },
    discount: { $sum: "$pricing.discountTotal" },
    commission: { $sum: "$earnings.commissionAmount" },
    vendorEarnings: { $sum: "$earnings.vendorEarning" },
    // Inner `$sum` folds the line array; outer `$sum` folds the group.
    units: { $sum: { $sum: "$items.quantity" } },
    subOrders: { $sum: 1 },
    orders: { $addToSet: "$order" },
  } as const;

  private static readonly SALES_PROJECTION = {
    _id: 0,
    gmv: 1,
    shipping: 1,
    tax: 1,
    discount: 1,
    commission: 1,
    vendorEarnings: 1,
    units: 1,
    subOrders: 1,
    orders: { $size: "$orders" },
  } as const;

  private static async salesTotals(
    match: QueryFilter<ISubOrder>,
  ): Promise<SalesTotals> {
    const [row] = await SubOrder.aggregate<RawSalesRow>([
      { $match: match },
      { $group: { _id: null, ...AdminService.SALES_ACCUMULATORS } },
      { $project: AdminService.SALES_PROJECTION },
    ]);

    // No matching sub-orders produces no group at all, not a zero row.
    return AdminService.toTotals(row ?? EMPTY_SALES);
  }

  private static async salesSeries(
    match: QueryFilter<ISubOrder>,
    interval: AnalyticsInterval,
    range: ResolvedRange,
  ): Promise<SeriesPoint[]> {
    const rows = await SubOrder.aggregate<RawSeriesRow>([
      { $match: match },
      {
        $group: {
          _id: {
            // Bucketed in the analytics zone by Mongo itself, so the keys
            // match the ones `bucketKeys` generates in Node.
            $dateToString: {
              format: interval === "day" ? "%Y-%m-%d" : "%Y-%m",
              date: "$placedAt",
              timezone: TIMEZONE,
            },
          },
          ...AdminService.SALES_ACCUMULATORS,
        },
      },
      { $project: { ...AdminService.SALES_PROJECTION, date: "$_id" } },
    ]);

    const byDate = new Map(rows.map((row) => [row.date, row]));

    return bucketKeys(range, interval).map((date) => {
      const { averageOrderValue: _perOrder, ...totals } = AdminService.toTotals(
        byDate.get(date) ?? EMPTY_SALES,
      );
      return { date, ...totals };
    });
  }

  /**
   * Rounds every figure to cents at the boundary.
   *
   * Mongo sums doubles, so a few thousand line totals accumulate float
   * error a few digits down — enough for a dashboard to render
   * `48264.999999999996`. Rounding here rather than in each caller means no
   * figure can escape unrounded.
   */
  private static toTotals(row: RawSalesRow): SalesTotals {
    return {
      gmv: money(row.gmv),
      shipping: money(row.shipping),
      tax: money(row.tax),
      discount: money(row.discount),
      commission: money(row.commission),
      vendorEarnings: money(row.vendorEarnings),
      orders: row.orders,
      subOrders: row.subOrders,
      units: row.units,
      averageOrderValue: row.orders === 0 ? 0 : money(row.gmv / row.orders),
    };
  }

  private static async vendorCounts(): Promise<VendorCounts> {
    const rows = await Vendor.aggregate<CountRow<VendorStatus>>([
      { $match: NOT_DELETED },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // Seeded from the enum so a status nobody is currently in reports 0
    // rather than going missing from the response shape.
    const counts = Object.fromEntries(
      VENDOR_STATUSES.map((status) => [status.toLowerCase(), 0]),
    ) as Record<Lowercase<VendorStatus>, number>;

    let total = 0;
    for (const row of rows) {
      counts[row._id.toLowerCase() as Lowercase<VendorStatus>] = row.count;
      total += row.count;
    }

    return { ...counts, total };
  }

  private static async customerCounts(
    range: ResolvedRange,
  ): Promise<{ total: number; newInRange: number }> {
    // Buyers only. Merchants and staff are counted under `vendors`, and
    // folding them in here would inflate the number an operator reads as
    // demand.
    const buyers: QueryFilter<IUser> = {
      role: "USER",
      status: { $ne: "DELETED" },
    };

    const [total, newInRange] = await Promise.all([
      User.countDocuments(buyers),
      User.countDocuments({
        ...buyers,
        createdAt: { $gte: range.from, $lt: range.to },
      }),
    ]);

    return { total, newInRange };
  }

  private static async catalogueCounts(
    scope: QueryFilter<IProduct>,
  ): Promise<CatalogueCounts> {
    const [row] = await Product.aggregate<CatalogueCounts>([
      { $match: { ...scope, ...NOT_DELETED } },
      {
        $group: {
          _id: null,
          products: { $sum: 1 },
          // Zero stock and low stock are counted separately and never
          // overlap: an unbuyable listing is a different problem from one
          // that needs restocking, and summing them would hide the first
          // inside the second.
          outOfStock: { $sum: { $cond: [{ $lte: ["$stock", 0] }, 1, 0] } },
          lowStock: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: ["$stock", 0] },
                    { $lte: ["$stock", LOW_STOCK_THRESHOLD] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      { $project: { _id: 0, products: 1, outOfStock: 1, lowStock: 1 } },
    ]);

    return row ?? { products: 0, outOfStock: 0, lowStock: 0 };
  }

  /**
   * Money by payout state, all time rather than windowed.
   *
   * "What do we owe?" is a question about now, not about the reporting
   * period: a sale from two months ago that has not been transferred is
   * still owed, and a 30-day window would hide exactly the debts that have
   * been outstanding longest.
   */
  private static async payoutTotals(
    scope: QueryFilter<ISubOrder>,
  ): Promise<PayoutTotals> {
    const rows = await SubOrder.aggregate<PayoutRow>([
      { $match: scope },
      {
        $group: {
          _id: "$payoutState",
          amount: { $sum: "$earnings.vendorEarning" },
        },
      },
    ]);

    const totals = Object.fromEntries(
      PAYOUT_STATES.map((state) => [state.toLowerCase(), 0]),
    ) as PayoutTotals;

    for (const row of rows) {
      totals[row._id.toLowerCase() as Lowercase<PayoutState>] = money(
        row.amount,
      );
    }

    return totals;
  }

  /** The open worklist — parcels neither delivered nor cancelled. */
  private static async fulfilmentCounts(
    scope: QueryFilter<ISubOrder>,
  ): Promise<Record<OpenStatus, number>> {
    const rows = await SubOrder.aggregate<CountRow<OpenStatus>>([
      { $match: { ...scope, status: { $in: [...OPEN_STATUSES] } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const counts = Object.fromEntries(
      OPEN_STATUSES.map((status) => [status, 0]),
    ) as Record<OpenStatus, number>;

    for (const row of rows) {
      counts[row._id] = row.count;
    }

    return counts;
  }
}

export const adminService = new AdminService();
