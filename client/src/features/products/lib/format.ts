/**
 * Presentation helpers for a product.
 *
 * The money, count and date formatters moved to `@/lib/format` once the
 * cart and orders needed them too — a total is a total wherever it is
 * rendered. They are re-exported here so this stays the one import a
 * product component reaches for.
 */
export { formatCount, formatDate, formatPrice } from "@/lib/format";

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
