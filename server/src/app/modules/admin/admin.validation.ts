import { z } from "zod";

/**
 * The windows the dashboard's range picker offers.
 *
 * A fixed set rather than free text because that is what the UI is — a row
 * of buttons — and because every preset is a span the aggregations can
 * serve without grouping the whole collection.
 */
export const ANALYTICS_RANGES = ["7d", "30d", "90d", "365d"] as const;

export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

/** How many days back each preset reaches, today included. */
export const RANGE_DAYS: Record<AnalyticsRange, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "365d": 365,
};

/** Bucket width for the timeseries endpoints. */
export const ANALYTICS_INTERVALS = ["day", "month"] as const;

export type AnalyticsInterval = (typeof ANALYTICS_INTERVALS)[number];

/**
 * Longest explicit `from`/`to` span accepted. A client asking for ten years
 * is either a bug or an attempt to make the server group the entire
 * collection; both are better answered with a 400 than a stalled process.
 */
export const MAX_RANGE_DAYS = 400;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const rangeShape = {
  range: z.enum(ANALYTICS_RANGES).optional().default("30d"),

  /**
   * Plain calendar dates (`2026-09-01`), not instants: a report is asked
   * for in the operator's own days, and the service anchors these to
   * midnight in the analytics timezone. Accepting an ISO datetime here
   * would look more precise while quietly meaning something else in UTC.
   */
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
};

/**
 * `from`/`to` override the preset, but only as a pair — one without the
 * other is ambiguous ("from the 1st" until when: today, or the preset's
 * end?) and the two readings differ by weeks.
 *
 * The comparisons are string comparisons on purpose: `YYYY-MM-DD` sorts
 * chronologically, so this needs no parsing and cannot be thrown off by
 * the server's own timezone.
 */
const checkRange = (
  value: { from?: string | undefined; to?: string | undefined },
  ctx: z.RefinementCtx,
): void => {
  const { from, to } = value;

  if ((from === undefined) !== (to === undefined)) {
    ctx.addIssue({
      code: "custom",
      path: [from === undefined ? "from" : "to"],
      message: "from and to must be supplied together",
    });
    return;
  }

  if (from === undefined || to === undefined) return;

  if (from > to) {
    ctx.addIssue({
      code: "custom",
      path: ["from"],
      message: "from must not be after to",
    });
    return;
  }

  const spanDays =
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      MS_PER_DAY +
    1;

  if (spanDays > MAX_RANGE_DAYS) {
    ctx.addIssue({
      code: "custom",
      path: ["to"],
      message: `Range cannot exceed ${String(MAX_RANGE_DAYS)} days`,
    });
  }
};

export const overviewQuerySchema = z
  .object(rangeShape)
  .strict()
  .superRefine(checkRange);

/**
 * `interval` is left without a default so the service can pick one from
 * the resolved span — a year of daily points is 365 dots on a chart nobody
 * can read, and a week of monthly ones is a single bar.
 */
export const timeseriesQuerySchema = z
  .object({
    ...rangeShape,
    interval: z.enum(ANALYTICS_INTERVALS).optional(),
  })
  .strict()
  .superRefine(checkRange);

export type OverviewQuery = z.infer<typeof overviewQuerySchema>;
export type TimeseriesQuery = z.infer<typeof timeseriesQuerySchema>;
