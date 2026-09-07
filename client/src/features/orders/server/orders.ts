import "server-only";

import { isApiError } from "@/lib/api";
import { serverApi } from "@/lib/api/server";
import {
  getOrderByNumberRequest,
  getOrderRequest,
  listMyOrdersRequest,
} from "../api/order.api";
import {
  emptyOrderPage,
  type OrderDetail,
  type OrderFilters,
  type OrderPage,
} from "../types";

export interface OrderListResult {
  page: OrderPage;
  /** Set when the list could not be read; `page` is empty then. */
  error: string | null;
}

/**
 * A page of the signed-in customer's own orders.
 *
 * Scoped by the session, never by a user id in the URL — `listMine` filters
 * on the caller, so there is no id to get wrong.
 *
 * A failed request is returned rather than thrown, for the same reason as
 * `listProducts`: the filter tabs should survive an unreachable API.
 */
export async function listMyOrders(
  filters: OrderFilters,
): Promise<OrderListResult> {
  const { path, ...options } = listMyOrdersRequest(filters);

  try {
    const page = await serverApi<OrderPage>(path, options);
    return { page, error: null };
  } catch (caught) {
    if (isApiError(caught)) {
      return { page: emptyOrderPage(filters.limit), error: caught.message };
    }
    throw caught;
  }
}

/**
 * One order with its per-shop parts, or `null` when it does not exist.
 *
 * `null` also covers 403: the API refuses an order belonging to someone
 * else, and to the person asking that is indistinguishable from a wrong URL
 * — which is the point. Confirming "this order exists but is not yours"
 * would leak that an order number is real.
 */
export async function getOrder(id: string): Promise<OrderDetail | null> {
  const { path, ...options } = getOrderRequest(id);
  return readOrder(path, options);
}

/** The same read, addressed by the reference on the confirmation email. */
export async function getOrderByNumber(
  orderNumber: string,
): Promise<OrderDetail | null> {
  const { path, ...options } = getOrderByNumberRequest(orderNumber);
  return readOrder(path, options);
}

async function readOrder(
  path: string,
  options: Parameters<typeof serverApi>[1],
): Promise<OrderDetail | null> {
  try {
    return await serverApi<OrderDetail>(path, options);
  } catch (caught) {
    if (
      isApiError(caught) &&
      (caught.isNotFound || caught.isForbidden || caught.status === 400)
    ) {
      // 400 covers a malformed id — `/orders/not-an-id` is a wrong URL, not
      // a server fault.
      return null;
    }
    throw caught;
  }
}
