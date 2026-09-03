"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { CurrentUser } from "../types";

/**
 * Carries the app's user record (role, status — the fields Clerk doesn't
 * know about) from the server down to Client Components.
 *
 * The record is fetched once per request in a Server Component and passed in
 * as a prop, so the browser never re-fetches `/user/me` just to render a nav
 * item. Clerk's own `useUser()` remains the source for identity/profile.
 */
const CurrentUserContext = createContext<CurrentUser | null>(null);

export function CurrentUserProvider({
  user,
  children,
}: {
  user: CurrentUser | null;
  children: ReactNode;
}) {
  return (
    <CurrentUserContext value={user}>{children}</CurrentUserContext>
  );
}

/** The app user record, or `null` when signed out. */
export function useCurrentUser(): CurrentUser | null {
  return useContext(CurrentUserContext);
}
