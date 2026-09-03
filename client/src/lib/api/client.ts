"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback } from "react";
import { apiRequest, type RequestOptions } from "./http";

/**
 * Browser-side API caller bound to the current Clerk session.
 *
 * Clerk session tokens are short-lived, so the token is fetched per request
 * via `getToken()` (which refreshes as needed) rather than captured once.
 */
export function useApi() {
  const { getToken } = useAuth();

  return useCallback(
    <T>(path: string, options: Omit<RequestOptions, "getToken"> = {}) =>
      apiRequest<T>(path, { ...options, getToken }),
    [getToken],
  );
}
