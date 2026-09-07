/**
 * Mirrors `IUser` from the server's `modules/users/user.model.ts` as staff
 * see it — a superset of `CurrentUser` in `features/auth/types.ts`, which is
 * only ever the signed-in person's own record.
 *
 * Kept as its own feature rather than folded into `auth` because the two are
 * different concerns: `auth` is "who am I", this is "who are our customers".
 */

import type { UserRole } from "@/features/auth/types";

export const USER_ROLES = [
  "USER",
  "MERCHANT",
  "ADMIN",
  "SUPER_ADMIN",
] as const satisfies readonly UserRole[];

export const USER_STATUSES = ["ACTIVE", "SUSPENDED", "DELETED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export interface ManagedUser {
  _id: string;
  clerkId: string;
  firstName: string;
  lastName?: string;
  email: string;
  avatarUrl?: string | null;
  role: UserRole;
  status: UserStatus;
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserFilters {
  role: UserRole | null;
  status: UserStatus | null;
  search: string;
  page: number;
  limit: number;
}

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  USER: "Customer",
  MERCHANT: "Merchant",
  ADMIN: "Admin",
  SUPER_ADMIN: "Super admin",
};

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  DELETED: "Deleted",
};

export type { UserRole };
