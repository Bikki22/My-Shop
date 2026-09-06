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
} as const;
