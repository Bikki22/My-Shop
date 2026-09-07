import type { RequestOptions } from "@/lib/api";
import type { UserFilters, UserRole, UserStatus } from "../types";

/**
 * The staff half of the server's `/api/v1/user` router.
 *
 * The self-service half (`/user/me`) lives in `features/auth/api/user.api.ts`
 * — same router, but a different concern and a different audience, and
 * keeping them apart is what stops an account page importing an admin call.
 */
export const userAdminEndpoints = {
  list: "/user",
  byId: (id: string) => `/user/${id}`,
} as const;

type Request = { path: string } & RequestOptions;

export const listUsersRequest = (filters: UserFilters): Request => ({
  path: userAdminEndpoints.list,
  method: "GET",
  searchParams: {
    page: filters.page,
    limit: filters.limit,
    role: filters.role ?? undefined,
    status: filters.status ?? undefined,
    search: filters.search || undefined,
  },
});

export const getUserRequest = (id: string): Request => ({
  path: userAdminEndpoints.byId(id),
  method: "GET",
});

/**
 * Changing what someone may do, and whether they may do anything.
 *
 * Two endpoints rather than one patch, because they are different decisions
 * with different consequences: a role change grants capability, a status
 * change revokes access entirely. The server also guards them differently —
 * it refuses to let an admin demote or suspend themselves.
 */
export const updateUserRoleRequest = (id: string, role: UserRole): Request => ({
  path: `${userAdminEndpoints.byId(id)}/role`,
  method: "PATCH",
  body: { role },
});

export const updateUserStatusRequest = (
  id: string,
  status: UserStatus,
): Request => ({
  path: `${userAdminEndpoints.byId(id)}/status`,
  method: "PATCH",
  body: { status },
});
