import "server-only";

import { auth } from "@clerk/nextjs/server";
import { forbidden } from "next/navigation";
import { ADMIN_ROLES, MERCHANT_ROLES, hasRole } from "../permissions";
import type { CurrentUser, UserRole } from "../types";
import { getCurrentUser } from "./current-user";

/**
 * Server-side guards for layouts, pages, Route Handlers and Server Actions.
 *
 * The proxy already bounces signed-out visitors away from protected paths,
 * but that's a routing convenience, not the security boundary — a Server
 * Action or a Route Handler can be invoked directly. These guards are what
 * actually enforce access, so call one in every protected layout.
 */

/** Requires a signed-in user with a provisioned account record. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();

  if (!user) {
    const { redirectToSignIn } = await auth();
    // Returns `never` — it throws the redirect. Returned rather than called
    // bare because TS only narrows on never-returning calls through an
    // explicitly annotated identifier, which a destructured const is not.
    return redirectToSignIn();
  }

  return user;
}

/** Requires a signed-in user holding one of `roles`; otherwise renders 403. */
export async function requireRole(
  roles: readonly UserRole[],
): Promise<CurrentUser> {
  const user = await requireUser();

  if (!hasRole(user, roles)) {
    forbidden();
  }

  return user;
}

export const requireAdmin = () => requireRole(ADMIN_ROLES);
export const requireMerchant = () => requireRole(MERCHANT_ROLES);
