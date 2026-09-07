import type { RequestOptions } from "@/lib/api";

/** Public storefront paths on the server's `/api/v1/vendors` router. */
export const vendorEndpoints = {
  byId: (id: string) => `/vendors/${id}`,
  bySlug: (slug: string) => `/vendors/slug/${slug}`,
} as const;

type Request = { path: string } & RequestOptions;

export const getVendorRequest = (id: string): Request => ({
  path: vendorEndpoints.byId(id),
  method: "GET",
});
