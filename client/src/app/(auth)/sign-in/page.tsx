import type { Metadata } from "next";
import { SignInForm } from "@/features/auth/components/sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

/**
 * A plain segment rather than the optional catch-all this used to be: the
 * catch-all only existed because Clerk's prebuilt `<SignIn />` routes its
 * own multi-step flows (factor two, reset password) under the sign-in path.
 * `SignInForm` drives those steps in place, so there are no sub-paths left
 * to catch — and a concrete `/sign-in` is what `typedRoutes` can check.
 *
 * Adding a social provider later would reintroduce a callback sub-path;
 * that wants its own `sign-in/sso-callback/page.tsx`.
 */
export default function SignInPage() {
  return <SignInForm />;
}
