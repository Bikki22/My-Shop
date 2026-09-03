import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign in" };

/**
 * The optional catch-all segment is required: Clerk routes its multi-step
 * flows (factor two, SSO callback, reset password) under this path.
 */
export default function SignInPage() {
  return <SignIn />;
}
