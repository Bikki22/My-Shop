/**
 * Presentation helpers for a product.
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

/** Below this many units the card nudges the shopper. */
export const LOW_STOCK_THRESHOLD = 5;

export type StockState = "out" | "low" | "in";

export const stockState = (stock: number): StockState => {
  if (stock <= 0) return "out";
  if (stock <= LOW_STOCK_THRESHOLD) return "low";
  return "in";
};

export const stockLabel = (stock: number): string => {
  switch (stockState(stock)) {
    case "out":
      return "Sold out";
    case "low":
      return `Only ${String(stock)} left`;
    default:
      return "In stock";
  }
};
