import "server-only";

import { isApiError } from "@/lib/api";
import { serverApi } from "@/lib/api/server";
import {
  getAdminOrderRequest,
  getVendorSubOrderRequest,
  listAdminOrdersRequest,
  listVendorSubOrdersRequest,
} from "../api/order.api";
import {
  emptyOrderPage,
  emptySubOrderPage,
  type OrderDetail,
  type OrderPage,
  type OrderStatus,
  type PaymentStatus,
  type SellerSubOrder,
  type SubOrderFilters,
  type SubOrderPage,
} from "../types";

/**
 * The fulfilment queues: one shop's, and the whole marketplace's.
 *
 * Separate from `server/orders.ts`, which is the *customer's* view of their
 * own history. The split matters because the payloads differ — these carry
 * the `earnings` and `payoutState` a shopper must never see — and keeping
 * them in different modules is what stops a customer-facing component
 * importing one by accident.
 *
 * Failures are returned rather than thrown, the same contract the rest of the
 * app keeps: a filter bar should survive an unreachable API.
 */

export interface SubOrderQueueResult {
  page: SubOrderPage;
  error: string | null;
}

export async function listVendorQueue(
  filters: SubOrderFilters,
): Promise<SubOrderQueueResult> {
  const { path, ...options } = listVendorSubOrdersRequest(filters);

  try {
    const page = await serverApi<SubOrderPage>(path, options);
    return { page, error: null };
  } catch (caught) {
    if (isApiError(caught)) {
      return { page: emptySubOrderPage(filters.limit), error: caught.message };
    }
    throw caught;
  }
}

/**
 * One parcel from the shop's queue, or `null`.
 *
 * `null` also covers 403 — the API refuses a parcel belonging to another
 * shop, and to the merchant asking that is indistinguishable from a wrong
 * URL, which is the point. Confirming "this parcel exists but is not yours"
 * would leak that a sub-order number is real.
 */
export async function getVendorSubOrder(
  subOrderId: string,
): Promise<SellerSubOrder | null> {
  const { path, ...options } = getVendorSubOrderRequest(subOrderId);

  try {
    return await serverApi<SellerSubOrder>(path, options);
  } catch (caught) {
    if (
      isApiError(caught) &&
      (caught.isNotFound || caught.isForbidden || caught.status === 400)
    ) {
      return null;
    }
    throw caught;
  }
}

export interface AdminOrdersResult {
  page: OrderPage;
  error: string | null;
}

export async function listAdminOrders(filters: {
  page: number;
  limit: number;
  status?: OrderStatus | null;
  paymentStatus?: PaymentStatus | null;
  orderNumber?: string;
}): Promise<AdminOrdersResult> {
  const { path, ...options } = listAdminOrdersRequest(filters);

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

/** One order with every shop's part, for staff. */
export async function getAdminOrder(id: string): Promise<OrderDetail | null> {
  const { path, ...options } = getAdminOrderRequest(id);

  try {
    return await serverApi<OrderDetail>(path, options);
  } catch (caught) {
    if (
      isApiError(caught) &&
      (caught.isNotFound || caught.isForbidden || caught.status === 400)
    ) {
      return null;
    }
    throw caught;
  }
}
