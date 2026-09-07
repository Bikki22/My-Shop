import "server-only";

import { emptyResultPage, isApiError, type Page } from "@/lib/api";
import { serverApi } from "@/lib/api/server";
import { listUsersRequest } from "../api/user-admin.api";
import type { ManagedUser, UserFilters } from "../types";

export interface UsersResult {
  page: Page<ManagedUser>;
  error: string | null;
}

/**
 * A page of accounts, for the customers screen.
 *
 * Failures are returned rather than thrown, the same contract every other
 * list read in the app keeps.
 */
export async function listUsers(filters: UserFilters): Promise<UsersResult> {
  const { path, ...options } = listUsersRequest(filters);

  try {
    const page = await serverApi<Page<ManagedUser>>(path, options);
    return { page, error: null };
  } catch (caught) {
    if (isApiError(caught)) {
      return {
        page: emptyResultPage<ManagedUser>(filters.limit),
        error: caught.message,
      };
    }
    throw caught;
  }
}
