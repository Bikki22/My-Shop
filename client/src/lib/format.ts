/**
 * Money, count and date formatting, shared by every feature.
 *
 * These live here rather than in a feature because a cart line, an order
 * total and a product price have to read identically — a shopper who is
 * quoted `Rs. 1,450` on a listing and `NPR 1450.00` at checkout has been
 * given two different prices as far as they can tell.
 *
 * The marketplace settles in NPR (the payment module's amounts are in
 * rupees, and the server's receipt emails render `Rs. …`), so the currency
 * is fixed here rather than guessed from the visitor's locale — a price
 * relabelled as dollars because someone is browsing from abroad would be
 * a lie about what they are charged.
 */
const priceFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export const formatPrice = (value: number): string =>
  `Rs. ${priceFormatter.format(value)}`;

const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export const formatCount = (value: number): string =>
  compactFormatter.format(value);

export const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/** Day plus time — for an audit trail, where the hour matters. */
export const formatDateTime = (iso: string): string =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/** `Jul 10` — the compact stamp the order tracker puts under each step. */
export const formatShortDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** `1 item` / `3 items`, so callers stop hand-rolling the plural. */
export const pluralize = (
  count: number,
  singular: string,
  plural = `${singular}s`,
): string => `${String(count)} ${count === 1 ? singular : plural}`;

/**
 * `Rs. 4.8L`, `Rs. 2.1Cr` — a headline figure that has to fit in a stat card.
 *
 * `en-IN` compact notation, so large amounts read in lakhs and crores the way
 * the rest of the market quotes them, rather than as `482K`. Reserved for
 * dashboard tiles: anywhere the exact amount matters — a cart line, an order
 * total, a payout — must use `formatPrice`, because a shopper cannot check a
 * rounded number against their bank statement.
 */
const compactPriceFormatter = new Intl.NumberFormat("en-IN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export const formatCompactPrice = (value: number): string =>
  `Rs. ${compactPriceFormatter.format(value)}`;

/** `13%` — a stored commission rate (`0.13`) as a percentage. */
export const formatRate = (rate: number): string =>
  `${(rate * 100).toFixed(rate * 100 % 1 === 0 ? 0 : 1)}%`;
