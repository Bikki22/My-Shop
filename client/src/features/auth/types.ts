/**
 * Mirrors `IUser` from the server's `modules/users/user.model.ts`, as it
 * arrives over the wire: `_id` is serialized to a string and every `Date`
 * to an ISO string.
 */

export const USER_ROLES = ["USER", "MERCHANT", "ADMIN", "SUPER_ADMIN"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["ACTIVE", "SUSPENDED", "DELETED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export interface CurrentUser {
  _id: string;
  clerkId: string;
  firstName: string;
  lastName?: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  role: UserRole;
  status: UserStatus;
  lastLogin?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  avatarUrl?: string | null;
}
