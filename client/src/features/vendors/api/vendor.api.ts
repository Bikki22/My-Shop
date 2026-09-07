import type { RequestOptions } from "@/lib/api";
import type {
  ApplyVendorInput,
  ReviewOutcome,
  UpdateMyVendorInput,
  VendorFilters,
} from "../types";

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

/** Everything beyond the public storefront read. */
export const vendorAdminEndpoints = {
  mine: "/vendors/me",
  apply: "/vendors/apply",
  adminList: "/vendors/admin",
  adminById: (id: string) => `/vendors/admin/${id}`,
} as const;

/** The signed-in merchant's own shop. No id: the server reads the session. */
export const getMyVendorRequest = (): Request => ({
  path: vendorAdminEndpoints.mine,
  method: "GET",
});

export const applyVendorRequest = (input: ApplyVendorInput): Request => ({
  path: vendorAdminEndpoints.apply,
  method: "POST",
  body: input,
});

/**
 * Self-service edits.
 *
 * `name` cannot be changed here and the server rejects it: the storefront
 * slug is derived from the name, and a URL that moves under customers' feet
 * breaks every link pointing at the shop. Renaming is an admin action.
 */
export const updateMyVendorRequest = (input: UpdateMyVendorInput): Request => ({
  path: vendorAdminEndpoints.mine,
  method: "PATCH",
  body: input,
});

/**
 * The staff queue. Unlike the public list this one can see every status,
 * which is the whole point — a shop awaiting review is not yet public.
 */
export const listVendorsAdminRequest = (filters: VendorFilters): Request => ({
  path: vendorAdminEndpoints.adminList,
  method: "GET",
  searchParams: {
    page: filters.page,
    limit: filters.limit,
    status: filters.status ?? undefined,
    search: filters.search || undefined,
  },
});

export const getVendorAdminRequest = (id: string): Request => ({
  path: vendorAdminEndpoints.adminById(id),
  method: "GET",
});

/**
 * Approving, rejecting or suspending a shop.
 *
 * `PENDING` is not an option the server accepts: an application returns to
 * pending by being re-submitted by its owner, never by staff pushing it back.
 * A reason is required for everything except approval.
 */
export const reviewVendorRequest = (
  id: string,
  status: ReviewOutcome,
  reason?: string,
): Request => ({
  path: `${vendorAdminEndpoints.adminById(id)}/review`,
  method: "PATCH",
  body: { status, ...(reason ? { reason } : {}) },
});

/** `null` hands the shop back to the platform's default rate. */
export const updateCommissionRequest = (
  id: string,
  commissionRate: number | null,
): Request => ({
  path: `${vendorAdminEndpoints.adminById(id)}/commission`,
  method: "PATCH",
  body: { commissionRate },
});

export const renameVendorRequest = (id: string, name: string): Request => ({
  path: `${vendorAdminEndpoints.adminById(id)}/name`,
  method: "PATCH",
  body: { name },
});
