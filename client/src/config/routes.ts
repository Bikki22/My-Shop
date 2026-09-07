/**
 * Single source of truth for pathnames, so a route rename is one edit here
 * rather than a hunt through navigation, guards and redirects.
 *
 * Two admin areas, and the names are worth reading carefully because the
 * design mockups use "admin" for both:
 *
 * - `seller.*` is one shop, run by its own owner (`MERCHANT`). Everything
 *   under it is scoped to `req.user`'s vendor by the API, so no shop id ever
 *   appears in these URLs — there is nothing to get wrong or to tamper with.
 * - `admin.*` is the whole marketplace, run by staff (`ADMIN`,
 *   `SUPER_ADMIN`). These do take ids, because an operator acts on shops and
 *   accounts other than their own.
 */

export const routes = {
  home: "/",
  signIn: "/sign-in",
  signUp: "/sign-up",
  /** Where Clerk returns the browser after a social provider redirect. */
  ssoCallback: "/sso-callback",
  account: "/account",
  products: "/products",
  /** A single listing. Filtered catalogue URLs are built by
   * `features/products/lib/product-filters.ts`, which owns the query
   * contract. */
  product: (id: string) => `/products/${id}` as const,
  /** A shop's public storefront, addressed by slug rather than id — it is a
   * page customers are meant to link to. */
  shop: (slug: string) => `/shops/${slug}` as const,
  cart: "/cart",
  checkout: "/checkout",
  /** The order history. Status-filtered URLs are built by
   * `features/orders/lib/order-filters.ts`, which owns that query contract. */
  orders: "/orders",
  order: (id: string) => `/orders/${id}` as const,
  /** Where checkout lands. Separate from the order page because it is a
   * receipt, shown once, not a screen to come back to. */
  orderConfirmation: (id: string) => `/orders/${id}/confirmation` as const,

  /** One shop, for the merchant who owns it. */
  seller: {
    root: "/seller",
    products: "/seller/products",
    newProduct: "/seller/products/new",
    product: (id: string) => `/seller/products/${id}` as const,
    orders: "/seller/orders",
    order: (subOrderId: string) => `/seller/orders/${subOrderId}` as const,
    payouts: "/seller/payouts",
    settings: "/seller/settings",
  },

  /** The application form, open to any signed-in user without a shop. */
  sellerApply: "/sell",

  /** The whole marketplace, for staff. */
  admin: {
    root: "/admin",
    vendors: "/admin/vendors",
    vendor: (id: string) => `/admin/vendors/${id}` as const,
    customers: "/admin/customers",
    orders: "/admin/orders",
    payouts: "/admin/payouts",
    categories: "/admin/categories",
  },
} as const;
