import "server-only";

import { isApiError } from "@/lib/api";
import { serverApi } from "@/lib/api/server";
import { getCartRequest } from "../api/cart.api";
import { emptyCart, type Cart } from "../types";

export interface CartResult {
  cart: Cart;
  /** Set when the cart could not be read; `cart` is empty then. */
  error: string | null;
}

/**
 * Reads the cart on the server, for a caller that has to *decide* something
 * before rendering — the checkout page, which bounces an empty or unorderable
 * cart back rather than showing a form that `POST /orders` would refuse.
 *
 * Pages that only display the cart use `prefetchCart` instead: that leaves the
 * query pending and hands the promise to the browser, so rendering is not
 * blocked on it. This one is awaited, which is the cost of needing the answer.
 *
 * A failed request is returned rather than thrown, for the same reason as
 * `listProducts`: an unreachable API should degrade the page to an
 * "unavailable" panel, not blow the route up to the error boundary.
 */
export async function getCart(): Promise<CartResult> {
  const { path, ...options } = getCartRequest();

  try {
    const cart = await serverApi<Cart>(path, options);
    return { cart, error: null };
  } catch (caught) {
    if (isApiError(caught)) {
      return { cart: emptyCart(), error: caught.message };
    }
    throw caught;
  }
}
