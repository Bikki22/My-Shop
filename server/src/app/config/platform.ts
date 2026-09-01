import { env } from "./env.js";

/**
 * The marketplace's charging policy, in one place.
 *
 * This used to be a hardcoded literal inside the checkout. It is read from
 * the environment instead so the numbers can differ between the sandbox and
 * production without a code change, and so there is exactly one thing to
 * point a future settings collection at.
 *
 * Shipping is charged **per vendor**: a customer buying from three shops
 * gets three parcels from three warehouses, so one flat fee spread across
 * all of them would have the platform quietly paying the difference.
 */
export const PRICING_POLICY = {
  /** Flat rate per vendor sub-order, waived once that sub-order is big enough. */
  shippingFee: env.SHIPPING_FLAT_FEE,
  freeShippingThreshold: env.FREE_SHIPPING_THRESHOLD,
  /** Fraction of the subtotal, e.g. 0.13 for 13%. */
  taxRate: env.TAX_RATE,
} as const;

/**
 * The delivery fee for one shop's parcel.
 *
 * The cart preview and the checkout both call this, so what the customer
 * is quoted and what they are charged cannot drift apart.
 */
export const shippingFeeFor = (vendorSubtotal: number): number =>
  vendorSubtotal >= PRICING_POLICY.freeShippingThreshold
    ? 0
    : PRICING_POLICY.shippingFee;

export const COMMISSION_POLICY = {
  /**
   * Fraction of each sale the platform keeps when a vendor has no
   * negotiated rate of their own (`Vendor.commissionRate === null`).
   */
  defaultRate: env.PLATFORM_COMMISSION_RATE,
} as const;

/**
 * The rate that applies to one vendor.
 *
 * A per-vendor override wins; otherwise the platform default. Kept as a
 * function rather than read inline so every caller resolves it the same
 * way — a sub-order priced with one rate and paid out at another is the
 * kind of bug nobody notices until a vendor does the arithmetic.
 */
export const commissionRateFor = (
  vendorRate: number | null | undefined,
): number => vendorRate ?? COMMISSION_POLICY.defaultRate;
