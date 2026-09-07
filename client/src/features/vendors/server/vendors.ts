import "server-only";

import { isApiError } from "@/lib/api";
import { serverApi } from "@/lib/api/server";
import { getVendorRequest } from "../api/vendor.api";
import type { VendorSummary } from "../types";

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
