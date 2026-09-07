import type { RequestOptions } from "@/lib/api";

/**
 * Endpoint paths for the server's `/api/v1/cart` router, kept in one place
 * so a backend route rename is a single-file change here.
 *
 * Every one of them is authenticated and scoped to the caller — the cart is
 * always addressed as "mine", never by id.
 */
export const cartEndpoints = {
  mine: "/cart",
  counts: "/cart/counts",
  items: "/cart/items",
  item: (productId: string) => `/cart/items/${productId}`,
} as const;

type Request = { path: string } & RequestOptions;

export const getCartRequest = (): Request => ({
  path: cartEndpoints.mine,
  method: "GET",
});

export const getCartCountsRequest = (): Request => ({
  path: cartEndpoints.counts,
  method: "GET",
});

/**
 * Adds to the cart, or tops up the line if the product is already in it.
 *
 * The body carries only the product and how many — the price is the
 * server's to decide, and `addCartItemBodySchema` is `.strict()`, so
 * sending one would be a 400 rather than a quietly ignored field.
 */
export const addCartItemRequest = (
  productId: string,
  quantity = 1,
): Request => ({
  path: cartEndpoints.items,
  method: "POST",
  body: { productId, quantity },
});

/** Sets an existing line to an absolute quantity. */
export const setCartItemQuantityRequest = (
  productId: string,
  quantity: number,
): Request => ({
  path: cartEndpoints.item(productId),
  method: "PATCH",
  body: { quantity },
});

export const removeCartItemRequest = (productId: string): Request => ({
  path: cartEndpoints.item(productId),
  method: "DELETE",
});

export const clearCartRequest = (): Request => ({
  path: cartEndpoints.mine,
  method: "DELETE",
});
