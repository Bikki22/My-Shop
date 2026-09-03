import type { CurrentUser, UpdateProfileInput } from "../types";

/**
 * Endpoint paths for the server's `/api/v1/user` router, kept in one place
 * so a backend route rename is a single-file change here.
 */
export const userEndpoints = {
  me: "/user/me",
} as const;

export const getMeRequest = () =>
  ({ path: userEndpoints.me, method: "GET" }) as const;

export const updateMeRequest = (input: UpdateProfileInput) =>
  ({ path: userEndpoints.me, method: "PATCH" as const, body: input }) as const;

export const deleteMeRequest = () =>
  ({ path: userEndpoints.me, method: "DELETE" }) as const;

export type { CurrentUser, UpdateProfileInput };
