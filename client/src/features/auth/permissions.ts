import type { CurrentUser, UserRole } from "./types";

/**
 * Role checks live here rather than in the components so the server guards
 * and the client-side gates can't disagree about what "admin" means.
 *
 * Roles come from *our* database (`GET /user/me`), not from Clerk — Clerk
 * only establishes identity, the marketplace role is ours to assign.
 */

export const ADMIN_ROLES: readonly UserRole[] = ["ADMIN", "SUPER_ADMIN"];
export const MERCHANT_ROLES: readonly UserRole[] = [
  "MERCHANT",
  "ADMIN",
  "SUPER_ADMIN",
];

export const hasRole = (
  user: Pick<CurrentUser, "role"> | null | undefined,
  roles: readonly UserRole[],
): boolean => (user ? roles.includes(user.role) : false);

export const isAdmin = (user: Pick<CurrentUser, "role"> | null | undefined) =>
  hasRole(user, ADMIN_ROLES);

export const isMerchant = (user: Pick<CurrentUser, "role"> | null | undefined) =>
  hasRole(user, MERCHANT_ROLES);
