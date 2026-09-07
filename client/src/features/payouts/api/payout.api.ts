import type { RequestOptions } from "@/lib/api";
import type { PayoutStatus } from "../types";

/**
 * Endpoint paths for the server's `/api/v1/payouts` router.
 *
 * Every route on it requires a session — money is never public — and the
 * `/me` pair carries no shop id because the server resolves the shop from
 * the caller.
 */
export const payoutEndpoints = {
  myBalance: "/payouts/me/balance",
  mine: "/payouts/me",
  byId: (id: string) => `/payouts/${id}`,
  breakdown: (id: string) => `/payouts/${id}/breakdown`,
  admin: "/payouts/admin",
  payable: "/payouts/admin/payable",
  adminById: (id: string) => `/payouts/admin/${id}`,
} as const;

type Request = { path: string } & RequestOptions;

export const getMyBalanceRequest = (): Request => ({
  path: payoutEndpoints.myBalance,
  method: "GET",
});

export const listMyPayoutsRequest = (filters: {
  page: number;
  limit: number;
  status?: PayoutStatus | null;
}): Request => ({
  path: payoutEndpoints.mine,
  method: "GET",
  searchParams: {
    page: filters.page,
    limit: filters.limit,
    status: filters.status ?? undefined,
  },
});

/** The parcels one payout settled — the shop's line-by-line proof. */
export const getPayoutBreakdownRequest = (id: string): Request => ({
  path: payoutEndpoints.breakdown(id),
  method: "GET",
});

export const listPayoutsAdminRequest = (filters: {
  page: number;
  limit: number;
  status?: PayoutStatus | null;
  vendor?: string;
}): Request => ({
  path: payoutEndpoints.admin,
  method: "GET",
  searchParams: {
    page: filters.page,
    limit: filters.limit,
    status: filters.status ?? undefined,
    vendor: filters.vendor || undefined,
  },
});

/** Every shop with money waiting, largest debt first. */
export const listPayableVendorsRequest = (): Request => ({
  path: payoutEndpoints.payable,
  method: "GET",
});

/**
 * Starts a payout run for one shop.
 *
 * There is no amount here on purpose, and the server would ignore one: what
 * is owed is whatever that shop's payable parcels add up to at the moment the
 * run claims them. An amount a client could send is an amount that disagrees
 * with the ledger.
 */
export const createPayoutRequest = (
  vendor: string,
  notes?: string,
): Request => ({
  path: payoutEndpoints.admin,
  method: "POST",
  body: { vendor, ...(notes ? { notes } : {}) },
});

/** Records that the transfer went through. The reference is required. */
export const markPayoutPaidRequest = (
  id: string,
  reference: string,
  notes?: string,
): Request => ({
  path: `${payoutEndpoints.adminById(id)}/paid`,
  method: "PATCH",
  body: { reference, ...(notes ? { notes } : {}) },
});

/**
 * Records that the transfer failed, which releases the parcels it held back
 * to payable — except any cancelled in the meantime, which are reversed.
 */
export const markPayoutFailedRequest = (
  id: string,
  reason: string,
): Request => ({
  path: `${payoutEndpoints.adminById(id)}/failed`,
  method: "PATCH",
  body: { reason },
});
