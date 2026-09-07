import type { Route } from "next";

import { ANALYTICS_RANGES, type AnalyticsRange } from "../types";

/**
 * The range lives in the URL, so a dashboard view is shareable, reload-safe
 * and back-button friendly — the same contract the catalogue and the order
 * history keep. This module owns that query contract in both directions.
 */

const DEFAULT_RANGE: AnalyticsRange = "30d";

const isRange = (value: unknown): value is AnalyticsRange =>
  typeof value === "string" &&
  (ANALYTICS_RANGES as readonly string[]).includes(value);

/**
 * Reads `?range=` off a resolved `searchParams`.
 *
 * An unrecognised value falls back to the default rather than erroring: a
 * hand-edited URL should show a dashboard, not a stack trace, and the server
 * would reject the bad value anyway.
 */
export function parseAnalyticsRange(
  searchParams: Record<string, string | string[] | undefined>,
): AnalyticsRange {
  const raw = searchParams["range"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return isRange(value) ? value : DEFAULT_RANGE;
}

/**
 * The href for one range chip, on the page it is rendered on.
 *
 * The default range produces a bare pathname rather than `?range=30d`, so the
 * canonical URL for a dashboard has no query at all and the two forms do not
 * compete as separate history entries.
 *
 * The cast is what `typedRoutes` asks for on a non-literal href: the value is
 * built from a `Route` plus a search string, which is a shape the route type
 * allows, but TypeScript cannot see that through a template literal.
 */
export const rangeHref = (pathname: Route, range: AnalyticsRange): Route =>
  range === DEFAULT_RANGE
    ? pathname
    : (`${pathname}?range=${range}` as Route);
