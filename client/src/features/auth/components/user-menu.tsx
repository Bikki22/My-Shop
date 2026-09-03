"use client";

import { SignInButton, SignUpButton, UserButton, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { routes } from "@/config/routes";
import { ADMIN_ROLES } from "../permissions";
import { RoleGate } from "./role-gate";

/**
 * The header's auth area: sign in / sign up for guests, Clerk's account
 * widget for members, plus an admin link for privileged roles.
 *
 * `isLoaded` is checked before branching so the guest buttons don't flash on
 * screen for a moment before Clerk resolves the session.
 *
 * Base UI's `Button` composes through a `render` element rather than
 * `asChild`, which is why the links are passed as `render={<Link />}`.
 */
export function UserMenu() {
  const { isLoaded, isSignedIn } = useUser();

  if (!isLoaded) {
    return <Skeleton className="h-8 w-36 rounded-lg" />;
  }

  if (!isSignedIn) {
    return (
      <div className="flex items-center gap-2">
        <SignInButton>
          <Button variant="ghost" size="sm">
            Sign in
          </Button>
        </SignInButton>
        <SignUpButton>
          <Button size="sm">Sign up</Button>
        </SignUpButton>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <RoleGate roles={ADMIN_ROLES}>
        <Button render={<Link href={routes.admin} />} variant="ghost" size="sm">
          Admin
        </Button>
      </RoleGate>

      <Button render={<Link href={routes.account} />} variant="ghost" size="sm">
        Account
      </Button>

      <UserButton />
    </div>
  );
}
