"use client";

import { useSignUp } from "@clerk/nextjs";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import {
  AuthCard,
  AuthField,
  AuthFormErrors,
  SocialAuth,
} from "./auth-form";

/**
 * Email + password sign-up, hand-rolled on `useSignUp`.
 *
 * The whole point of not using `<SignUp />` is this file: the fields below
 * are the *only* thing a customer is ever asked for. No phone number, no
 * "use phone instead" toggle — those come from Clerk's prebuilt UI reading
 * the instance's enabled identifiers, and there is no prop to turn them off.
 *
 * The flow is two steps, both derived from `signUp.status` rather than local
 * state so a refresh mid-signup resumes where the user left off (Clerk keeps
 * the attempt on the client):
 *
 *   1. `password()` creates the attempt, then `sendEmailCode()` mails a code.
 *   2. `verifyEmailCode()` completes it, and `finalize()` swaps the finished
 *      attempt for an active session.
 */
export function SignUpForm() {
  const { signUp, errors, fetchStatus } = useSignUp();

  const isBusy = fetchStatus === "fetching";

  /** Turns a completed attempt into an active session, then leaves. */
  const finalize = async () => {
    await signUp.finalize({
      navigate: ({ decorateUrl }) => {
        // A decorated URL can come back absolute (the Safari ITP handshake
        // redirects through Clerk), so this is a full navigation rather than
        // a soft push — which also guarantees every server component
        // re-renders against the new session.
        window.location.href = decorateUrl(routes.home);
      },
    });
  };

  /**
   * Hands the browser to Google. Clerk comes back to `ssoCallback`, which
   * works out whether this turned into a sign-up or matched an existing
   * account and finalizes accordingly.
   */
  const signUpWithGoogle = () => {
    void signUp.sso({
      strategy: "oauth_google",
      redirectUrl: routes.home,
      redirectCallbackUrl: routes.ssoCallback,
    });
  };

  const handleDetails = async (formData: FormData) => {
    const firstName = String(formData.get("firstName") ?? "").trim();
    const lastName = String(formData.get("lastName") ?? "").trim();

    const { error } = await signUp.password({
      emailAddress: String(formData.get("email") ?? "").trim(),
      password: String(formData.get("password") ?? ""),
      ...(firstName ? { firstName } : {}),
      ...(lastName ? { lastName } : {}),
    });

    // Field-level problems are already on `errors.fields`; re-reading them
    // here would just duplicate what the inputs render.
    if (error) return;

    // A required identifier we don't collect leaves the attempt unfinishable,
    // and `password()` reports that as a status rather than an error. Mailing
    // a code the user could never spend would just be a second dead end — the
    // render below explains the real problem instead.
    if (signUp.missingFields.length > 0) return;

    await signUp.verifications.sendEmailCode();
  };

  const handleVerify = async (formData: FormData) => {
    const { error } = await signUp.verifications.verifyEmailCode({
      code: String(formData.get("code") ?? "").trim(),
    });
    if (error) return;

    if (signUp.status === "complete") {
      await finalize();
    }
  };

  // Belt and braces: the (auth) layout already redirects signed-in users, but
  // this covers the instant between `finalize()` and that navigation landing.
  if (signUp.status === "complete") {
    return null;
  }

  /**
   * Clerk will not complete a sign-up while a *required* identifier is
   * unfilled. If the instance still has phone number marked required, this
   * form legitimately cannot finish it — say so plainly instead of leaving
   * the user on a button that silently does nothing.
   */
  if (signUp.missingFields.includes("phone_number")) {
    return (
      <AuthCard
        title="Sign-up unavailable"
        description="This account setup can't be completed right now."
      >
        <Alert variant="destructive">
          <AlertDescription>
            The Clerk instance still lists a phone number as a required
            sign-up field. Turn it off under Configure → User &amp;
            Authentication → Email, Phone, Username, then reload this page.
          </AlertDescription>
        </Alert>
      </AuthCard>
    );
  }

  const awaitingCode =
    signUp.status === "missing_requirements" &&
    signUp.unverifiedFields.includes("email_address") &&
    signUp.missingFields.length === 0;

  if (awaitingCode) {
    return (
      <AuthCard
        title="Check your email"
        description="Enter the code we just sent to confirm your address."
      >
        <form action={handleVerify} className="grid gap-4">
          <AuthFormErrors errors={errors.global} />
          <AuthField
            id="code"
            name="code"
            label="Verification code"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            error={errors.fields.code}
          />
          <Button type="submit" disabled={isBusy}>
            {isBusy ? "Verifying…" : "Verify email"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isBusy}
            onClick={() => void signUp.verifications.sendEmailCode()}
          >
            Send a new code
          </Button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create your account"
      description="All we need is your name, email and a password."
      footer={
        <span>
          Already have an account?{" "}
          <Link href={routes.signIn} className="text-foreground underline">
            Sign in
          </Link>
        </span>
      }
    >
      <form action={handleDetails} className="grid gap-4">
        <AuthFormErrors errors={errors.global} />

        <SocialAuth onGoogle={signUpWithGoogle} disabled={isBusy} />

        <div className="grid gap-4 sm:grid-cols-2">
          <AuthField
            id="firstName"
            name="firstName"
            label="First name"
            autoComplete="given-name"
            error={errors.fields.firstName}
          />
          <AuthField
            id="lastName"
            name="lastName"
            label="Last name"
            autoComplete="family-name"
            error={errors.fields.lastName}
          />
        </div>

        <AuthField
          id="email"
          name="email"
          type="email"
          label="Email address"
          autoComplete="email"
          required
          error={errors.fields.emailAddress}
        />
        <AuthField
          id="password"
          name="password"
          type="password"
          label="Password"
          autoComplete="new-password"
          required
          error={errors.fields.password}
        />

        <Button type="submit" disabled={isBusy}>
          {isBusy ? "Creating account…" : "Continue"}
        </Button>

        {/* Clerk's bot protection mounts its widget here. Without the node
            the challenge cannot render and sign-up fails on protected
            instances. */}
        <div id="clerk-captcha" />
      </form>
    </AuthCard>
  );
}
