/**
 * Single source of truth for pathnames, so a route rename is one edit here
 * rather than a hunt through navigation, guards and redirects.
 */

export const routes = {
  home: "/",
  signIn: "/sign-in",
  signUp: "/sign-up",
  account: "/account",
  admin: "/admin",
} as const;
