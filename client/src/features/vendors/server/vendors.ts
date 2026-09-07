import "server-only";

import { emptyResultPage, isApiError, type Page } from "@/lib/api";
import { serverApi } from "@/lib/api/server";
import {
  getMyVendorRequest,
  getVendorAdminRequest,
  getVendorRequest,
  listVendorsAdminRequest,
} from "../api/vendor.api";
import type { Vendor, VendorFilters, VendorSummary } from "../types";

/**
 * Resolves shop ids to names, for screens that hold a reference but not the
 * shop itself.
 *
 * Sub-orders are the case this exists for: they carry `vendor` as a raw id
 * (the orders module does not populate it, so a customer's history is one
 * query rather than a join per parcel), but "Riya Crafts is packing your
 * order" is far more use than a 24-character id.
 *
 * Missing ids are simply absent from the map. `GET /vendors/:id` serves
 * *sellable* shops only, so a suspended one 404s here — the caller falls
 * back to the parcel number rather than the screen failing over a heading.
 */
export async function getVendorSummaries(
  ids: readonly string[],
): Promise<Map<string, VendorSummary>> {
  const unique = [...new Set(ids)];

  const results = await Promise.all(
    unique.map(async (id) => {
      const { path, ...options } = getVendorRequest(id);
      try {
        return await serverApi<VendorSummary>(path, options);
      } catch (caught) {
        if (isApiError(caught)) return null;
        throw caught;
      }
    }),
  );

  return new Map(
    results
      .filter((vendor): vendor is VendorSummary => vendor !== null)
      .map((vendor) => [vendor._id, vendor]),
  );
}

/**
 * The signed-in merchant's own shop, or `null` if they do not have one.
 *
 * `null` rather than a throw because "no shop yet" is a normal state, not a
 * failure: it is what every user is before they apply, and the seller area
 * turns it into an invitation to apply rather than an error panel. The API
 * answers 403 for it (`You do not have a seller account`), which is why the
 * forbidden case is folded in here alongside 404.
 */
export async function getMyVendor(): Promise<Vendor | null> {
  const { path, ...options } = getMyVendorRequest();

  try {
    return await serverApi<Vendor>(path, options);
  } catch (caught) {
    if (isApiError(caught) && (caught.isNotFound || caught.isForbidden)) {
      return null;
    }
    throw caught;
  }
}

/** One page of the staff queue, with failures reported rather than thrown. */
export async function listVendorsForAdmin(
  filters: VendorFilters,
): Promise<{ page: Page<Vendor>; error: string | null }> {
  const { path, ...options } = listVendorsAdminRequest(filters);

  try {
    const page = await serverApi<Page<Vendor>>(path, options);
    return { page, error: null };
  } catch (caught) {
    if (isApiError(caught)) {
      return { page: emptyResultPage<Vendor>(filters.limit), error: caught.message };
    }
    throw caught;
  }
}

/** One shop as staff see it — the full record, including what is private. */
export async function getVendorForAdmin(id: string): Promise<Vendor | null> {
  const { path, ...options } = getVendorAdminRequest(id);

  try {
    return await serverApi<Vendor>(path, options);
  } catch (caught) {
    if (
      isApiError(caught) &&
      (caught.isNotFound || caught.isForbidden || caught.status === 400)
    ) {
      // 400 covers a malformed id — a wrong URL, not a server fault.
      return null;
    }
    throw caught;
  }
}
