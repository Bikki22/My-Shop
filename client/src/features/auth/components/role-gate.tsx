"use client";

import type { ReactNode } from "react";
import { hasRole } from "../permissions";
import type { UserRole } from "../types";
import { useCurrentUser } from "./current-user-provider";

/**
 * Renders `children` only for users holding one of `roles`.
 *
 * This hides UI; it does not protect data. Anything behind it must still be
 * guarded on the server (`requireRole`) and by the API, since a client-side
 * check is trivially bypassed.
 */
export function RoleGate({
  roles,
  fallback = null,
  children,
}: {
  roles: readonly UserRole[];
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const user = useCurrentUser();
  return hasRole(user, roles) ? <>{children}</> : <>{fallback}</>;
}
