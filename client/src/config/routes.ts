/**
 * Single source of truth for pathnames, so a route rename is one edit here
 * rather than a hunt through navigation, guards and redirects.
 */

export const routes = {
  home: "/",
  signIn: "/sign-in",
  signUp: "/sign-up",
  /** Where Clerk returns the browser after a social provider redirect. */
  ssoCallback: "/sso-callback",
  account: "/account",
  admin: "/admin",
  products: "/products",
  /** A single listing. Filtered catalogue URLs are built by
   * `features/products/lib/product-filters.ts`, which owns the query
   * contract. */
  product: (id: string) => `/products/${id}` as const,
  cart: "/cart",
  checkout: "/checkout",
  /** The order history. Status-filtered URLs are built by
   * `features/orders/lib/order-filters.ts`, which owns that query contract. */
  orders: "/orders",
  order: (id: string) => `/orders/${id}` as const,
  /** Where checkout lands. Separate from the order page because it is a
   * receipt, shown once, not a screen to come back to. */
  orderConfirmation: (id: string) => `/orders/${id}/confirmation` as const,
} as const;
