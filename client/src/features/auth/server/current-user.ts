import "server-only";

import { auth } from "@clerk/nextjs/server";
import { cache } from "react";
import { serverApi } from "@/lib/api/server";
import { isApiError } from "@/lib/api";
import { userEndpoints } from "../api/user.api";
import type { CurrentUser } from "../types";

/**
 * The signed-in user as *our* database knows them, or `null` for a guest.
 *
 * Wrapped in `cache()` so a layout, a page and a nested Server Component in
 * the same render share one request instead of hitting `/user/me` three times.
 *
 * Note this is the app's user record — `role` and `status` come from Mongo.
 * Clerk's `auth()` only tells us *who* is signed in.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const { isAuthenticated } = await auth();
  if (!isAuthenticated) return null;

  try {
    return await serverApi<CurrentUser>(userEndpoints.me);
  } catch (error) {
    // A suspended or deleted account answers 403, and a session that Clerk
    // still holds but the API rejects answers 401. Neither is a crash — the
    // caller should see a guest and decide what to do.
    if (isApiError(error) && (error.isUnauthorized || error.isForbidden)) {
      return null;
    }
    throw error;
  }
});
