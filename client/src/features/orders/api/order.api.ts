import type { RequestOptions } from "@/lib/api";
import type {
  CreateOrderInput,
  OrderFilters,
  OrderStatus,
  PaymentStatus,
  SubOrderFilters,
} from "../types";

/**
 * Endpoint paths for the server's `/api/v1/orders` router, kept in one place
 * so a backend route rename is a single-file change here.
 *
 * Only the customer-facing routes are listed. The vendor and admin queues
 * (`/orders/vendor`, `/orders/admin`) belong to whichever feature builds
 * those dashboards.
 */
export const orderEndpoints = {
  mine: "/orders",
  byId: (id: string) => `/orders/${id}`,
  byNumber: (orderNumber: string) => `/orders/number/${orderNumber}`,
  cancel: (id: string) => `/orders/${id}/cancel`,
  cancelSubOrder: (subOrderId: string) =>
    `/orders/sub-orders/${subOrderId}/cancel`,
} as const;

type Request = { path: string } & RequestOptions;

/**
 * Checkout.
 *
 * The body carries an address, a payment method and an optional note —
 * nothing else. The lines, the per-shop split and every money figure are
 * read from the cart server-side, and `createOrderBodySchema` is
 * `.strict()`, so a client cannot name its own price.
 *
 * `unwrap: false` because the response spreads `{ order, subOrders }` onto
 * the body instead of nesting it under `data`.
 */
export const createOrderRequest = (input: CreateOrderInput): Request => ({
  path: orderEndpoints.mine,
  method: "POST",
  unwrap: false,
  body: input,
});

/** `unwrap: false` — this endpoint answers `{ success, data, pagination }`. */
export const listMyOrdersRequest = (filters: OrderFilters): Request => ({
  path: orderEndpoints.mine,
  method: "GET",
  unwrap: false,
  searchParams: {
    page: filters.page,
    limit: filters.limit,
    sort: filters.sort,
    ...(filters.status ? { status: filters.status } : {}),
  },
});

export const getOrderRequest = (id: string): Request => ({
  path: orderEndpoints.byId(id),
  method: "GET",
  unwrap: false,
});

export const getOrderByNumberRequest = (orderNumber: string): Request => ({
  path: orderEndpoints.byNumber(orderNumber),
  method: "GET",
  unwrap: false,
});

/**
 * Cancels the whole order: every part that has not shipped yet. Parts
 * already with a courier are left alone, so this can legitimately come back
 * with some shops still fulfilling.
 */
export const cancelOrderRequest = (id: string, reason?: string): Request => ({
  path: orderEndpoints.cancel(id),
  method: "PATCH",
  unwrap: false,
  body: reason ? { reason } : {},
});

/** Cancels one shop's parcel, leaving the rest of the order standing. */
export const cancelSubOrderRequest = (
  subOrderId: string,
  reason?: string,
): Request => ({
  path: orderEndpoints.cancelSubOrder(subOrderId),
  method: "PATCH",
  body: reason ? { reason } : {},
});

/** The shop's and the platform's queues, beyond a customer's own history. */
export const orderQueueEndpoints = {
  vendor: "/orders/vendor",
  vendorSubOrder: (subOrderId: string) => `/orders/vendor/${subOrderId}`,
  adminOrders: "/orders/admin",
  adminSubOrders: "/orders/admin/sub-orders",
  adminOrder: (id: string) => `/orders/admin/${id}`,
} as const;

/**
 * A shop's own parcel queue.
 *
 * There is no `vendor` parameter, and supplying one would not help: the
 * server overrides it with the caller's own shop id, so a merchant cannot
 * read another shop's queue.
 */
export const listVendorSubOrdersRequest = (
  filters: SubOrderFilters,
): Request => ({
  path: orderQueueEndpoints.vendor,
  method: "GET",
  searchParams: {
    page: filters.page,
    limit: filters.limit,
    status: filters.status ?? undefined,
    sort: "newest",
  },
});

export const getVendorSubOrderRequest = (subOrderId: string): Request => ({
  path: orderQueueEndpoints.vendorSubOrder(subOrderId),
  method: "GET",
});

/**
 * Moving a parcel along.
 *
 * `courier`/`trackingNumber` are only accepted alongside `SHIPPED` — the
 * server rejects them elsewhere rather than storing a tracking number against
 * a parcel that has not left the warehouse.
 */
export const updateSubOrderStatusRequest = (
  subOrderId: string,
  body: {
    status: OrderStatus;
    note?: string;
    courier?: string;
    trackingNumber?: string;
  },
): Request => ({
  path: `${orderQueueEndpoints.vendorSubOrder(subOrderId)}/status`,
  method: "PATCH",
  body,
});

/** Every order on the marketplace, for staff. */
export const listAdminOrdersRequest = (filters: {
  page: number;
  limit: number;
  status?: OrderStatus | null;
  paymentStatus?: PaymentStatus | null;
  orderNumber?: string;
}): Request => ({
  path: orderQueueEndpoints.adminOrders,
  method: "GET",
  searchParams: {
    page: filters.page,
    limit: filters.limit,
    status: filters.status ?? undefined,
    paymentStatus: filters.paymentStatus ?? undefined,
    orderNumber: filters.orderNumber || undefined,
    sort: "newest",
  },
});

export const getAdminOrderRequest = (id: string): Request => ({
  path: orderQueueEndpoints.adminOrder(id),
  method: "GET",
});
