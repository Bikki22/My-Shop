import {
  DEFAULT_ORDER_FILTERS,
  ORDER_STATUSES,
  type OrderFilters,
  type OrderStatus,
} from "../types";

/**
 * The order history's URL contract.
 *
 * Same rule as the catalogue's: the keys are the strings the API accepts, so
 * the address bar and the outgoing request never need translating.
 */
export const ORDER_PARAM = {
  status: "status",
  page: "page",
} as const;

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const isStatus = (value: string | undefined): value is OrderStatus =>
  ORDER_STATUSES.includes(value as OrderStatus);

/**
 * Reads filters out of a URL, falling back rather than throwing — a
 * hand-edited `?status=banana` should show every order, not a 500.
 */
export function parseOrderFilters(
  params: Record<string, string | string[] | undefined> | URLSearchParams,
): OrderFilters {
  const read = (key: string): string | undefined =>
    params instanceof URLSearchParams
      ? (params.get(key) ?? undefined)
      : first(params[key]);

  const status = read(ORDER_PARAM.status);
  const page = Number(read(ORDER_PARAM.page));

  return {
    ...DEFAULT_ORDER_FILTERS,
    status: isStatus(status) ? status : null,
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

/** An `/orders` href for these filters, defaults omitted. */
export function ordersHref(
  filters: Partial<OrderFilters>,
): "/orders" | `/orders?${string}` {
  const params = new URLSearchParams();

  if (filters.status) params.set(ORDER_PARAM.status, filters.status);
  if (filters.page && filters.page > 1)
    params.set(ORDER_PARAM.page, String(filters.page));

  const query = params.toString();
  return query ? `/orders?${query}` : "/orders";
}

/**
 * The design's filter tabs, mapped onto statuses the API actually accepts.
 *
 * `null` is "all". The tabs deliberately carry no counts: the list endpoint
 * reports a total for the *current* filter only, so a count per tab would
 * mean five requests to render a row of chips — or five numbers that are
 * quietly wrong.
 */
export const ORDER_FILTER_TABS: { label: string; status: OrderStatus | null }[] =
  [
    { label: "All orders", status: null },
    { label: "Being packed", status: "PROCESSING" },
    { label: "In transit", status: "SHIPPED" },
    { label: "Delivered", status: "DELIVERED" },
    { label: "Cancelled", status: "CANCELLED" },
  ];
