import "server-only";

import { isApiError } from "@/lib/api";
import { serverApi } from "@/lib/api/server";
import {
  getMyBalanceRequest,
  listMyPayoutsRequest,
  listPayableVendorsRequest,
  listPayoutsAdminRequest,
} from "../api/payout.api";
import {
  emptyPayoutPage,
  type PayableVendor,
  type PayoutPage,
  type PayoutStatus,
  type VendorBalance,
} from "../types";

/**
 * The payout reads, for both the shop's screen and the platform's.
 *
 * Every one returns its failure rather than throwing — the same contract the
 * rest of the app keeps, so a money screen degrades to an explanation instead
 * of an error boundary.
 */

export interface MyPayoutsResult {
  balance: VendorBalance | null;
  page: PayoutPage;
  error: string | null;
}

/**
 * A shop's balance and its transfer history, read together.
 *
 * Concurrent rather than sequential: they are independent, and the balance is
 * the figure the merchant came for — there is no reason to make it wait for a
 * page of history.
 */
export async function getMyPayouts(filters: {
  page: number;
  limit: number;
  status?: PayoutStatus | null;
}): Promise<MyPayoutsResult> {
  const balanceRequest = getMyBalanceRequest();
  const listRequest = listMyPayoutsRequest(filters);

  try {
    const [balance, page] = await Promise.all([
      serverApi<VendorBalance>(balanceRequest.path, {
        method: balanceRequest.method,
      }),
      serverApi<PayoutPage>(listRequest.path, {
        method: listRequest.method,
        searchParams: listRequest.searchParams,
      }),
    ]);

    return { balance, page, error: null };
  } catch (caught) {
    if (isApiError(caught)) {
      return {
        balance: null,
        page: emptyPayoutPage(filters.limit),
        error: caught.message,
      };
    }
    throw caught;
  }
}

export interface AdminPayoutsResult {
  payable: PayableVendor[];
  page: PayoutPage;
  error: string | null;
}

/**
 * The platform's payout screen: who is owed, and what has been sent.
 *
 * The two answer different questions — the queue is a list of debts to act
 * on, the history is a ledger of transfers already made — and the screen
 * needs both at once.
 */
export async function getAdminPayouts(filters: {
  page: number;
  limit: number;
  status?: PayoutStatus | null;
}): Promise<AdminPayoutsResult> {
  const payableRequest = listPayableVendorsRequest();
  const listRequest = listPayoutsAdminRequest(filters);

  try {
    const [payable, page] = await Promise.all([
      serverApi<PayableVendor[]>(payableRequest.path, {
        method: payableRequest.method,
      }),
      serverApi<PayoutPage>(listRequest.path, {
        method: listRequest.method,
        searchParams: listRequest.searchParams,
      }),
    ]);

    return { payable, page, error: null };
  } catch (caught) {
    if (isApiError(caught)) {
      return {
        payable: [],
        page: emptyPayoutPage(filters.limit),
        error: caught.message,
      };
    }
    throw caught;
  }
}
