"use client";

import { useSignIn } from "@clerk/nextjs";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import {
  AuthCard,
  AuthField,
  AuthFormErrors,
  SocialAuth,
} from "./auth-form";

/**
 * Email + password sign-in, hand-rolled on `useSignIn`.
 *
 * Like the sign-up form, this exists so the identifier is email and only
 * email. `<SignIn />` renders whatever the Clerk instance has enabled, which
 * is where the "use phone instead" affordance came from.
 *
 * Second factors are handled with an email code or an authenticator app —
 * deliberately not SMS, which would reintroduce the phone number by the back
 * door.
 */
export function SignInForm() {
  const { signIn, errors, fetchStatus } = useSignIn();

  // Password reset is a distinct intent, not a status Clerk can infer, so it
  // is the one piece of genuinely local state here.
  const [isResetting, setIsResetting] = useState(false);
  const [resetCodeSent, setResetCodeSent] = useState(false);

  const isBusy = fetchStatus === "fetching";

  /** Turns a completed attempt into an active session, then leaves. */
  const finalize = async () => {
    await signIn.finalize({
      navigate: ({ decorateUrl }) => {
        // A decorated URL can come back absolute (the Safari ITP handshake
        // redirects through Clerk), so this is a full navigation rather than
        // a soft push — which also guarantees every server component
        // re-renders against the new session.
        window.location.href = decorateUrl(routes.home);
      },
    });
  };

  /** The second factor we can serve without asking for a phone number. */
  const emailSecondFactor = signIn.supportedSecondFactors?.find(
    (factor) => factor.strategy === "email_code",
  );

  /**
   * Hands the browser to Google. Clerk comes back to `ssoCallback`, which
   * works out whether the account already exists or needs creating and
   * finalizes accordingly.
   */
  const signInWithGoogle = () => {
    void signIn.sso({
      strategy: "oauth_google",
      redirectUrl: routes.home,
      redirectCallbackUrl: routes.ssoCallback,
    });
  };

  const handlePassword = async (formData: FormData) => {
    const { error } = await signIn.password({
      emailAddress: String(formData.get("email") ?? "").trim(),
      password: String(formData.get("password") ?? ""),
    });
    if (error) return;

    if (signIn.status === "complete") {
      await finalize();
      return;
    }

    // Both of these states want a code in the user's inbox before the next
    // screen can do anything useful.
    if (
      signIn.status === "needs_client_trust" ||
      (signIn.status === "needs_second_factor" && emailSecondFactor)
    ) {
      await signIn.mfa.sendEmailCode();
    }
  };

  const handleSecondFactor = async (formData: FormData) => {
    const code = String(formData.get("code") ?? "").trim();

    const { error } =
      signIn.status === "needs_second_factor" && !emailSecondFactor
        ? await signIn.mfa.verifyTOTP({ code })
        : await signIn.mfa.verifyEmailCode({ code });
    if (error) return;

    if (signIn.status === "complete") {
      await finalize();
    }
  };

  const handleResetRequest = async (formData: FormData) => {
    // `resetPasswordEmailCode.sendCode()` mails the first address on the
    // account, so the sign-in needs an identifier attached before it runs.
    const { error } = await signIn.create({
      identifier: String(formData.get("email") ?? "").trim(),
    });
    if (error) return;

    const { error: sendError } = await signIn.resetPasswordEmailCode.sendCode();
    if (sendError) return;

    setResetCodeSent(true);
  };

  const handleResetVerify = async (formData: FormData) => {
    // A successful verify moves `status` to `needs_new_password`, which the
    // render below picks up — there is nothing else to do here.
    await signIn.resetPasswordEmailCode.verifyCode({
      code: String(formData.get("code") ?? "").trim(),
    });
  };

  const handleNewPassword = async (formData: FormData) => {
    const { error } = await signIn.resetPasswordEmailCode.submitPassword({
      password: String(formData.get("password") ?? ""),
    });
    if (error) return;

    if (signIn.status === "complete") {
      await finalize();
    }
  };

  const startOver = () => {
    signIn.reset();
    setIsResetting(false);
    setResetCodeSent(false);
  };

  // Belt and braces: the (auth) layout already redirects signed-in users, but
  // this covers the instant between `finalize()` and that navigation landing.
  if (signIn.status === "complete") {
    return null;
  }

  // ---- Password reset ---------------------------------------------------

  if (signIn.status === "needs_new_password") {
    return (
      <AuthCard
        title="Choose a new password"
        description="Pick something you have not used here before."
      >
        <form action={handleNewPassword} className="grid gap-4">
          <AuthFormErrors errors={errors.global} />
          <AuthField
            id="password"
            name="password"
            type="password"
            label="New password"
            autoComplete="new-password"
            required
            error={errors.fields.password}
          />
          <Button type="submit" disabled={isBusy}>
            {isBusy ? "Saving…" : "Save and sign in"}
          </Button>
        </form>
      </AuthCard>
    );
  }

  if (isResetting) {
    return (
      <AuthCard
        title="Reset your password"
        description={
          resetCodeSent
            ? "Enter the code we emailed you."
            : "We will email you a code to reset it."
        }
      >
        <form
          action={resetCodeSent ? handleResetVerify : handleResetRequest}
          className="grid gap-4"
        >
          <AuthFormErrors errors={errors.global} />
          {resetCodeSent ? (
            <AuthField
              id="code"
              name="code"
              label="Reset code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              error={errors.fields.code}
            />
          ) : (
            <AuthField
              id="email"
              name="email"
              type="email"
              label="Email address"
              autoComplete="email"
              required
              error={errors.fields.identifier}
            />
          )}
          <Button type="submit" disabled={isBusy}>
            {isBusy ? "Working…" : resetCodeSent ? "Verify code" : "Send code"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={startOver}
            disabled={isBusy}
          >
            Back to sign in
          </Button>
        </form>
      </AuthCard>
    );
  }

  // ---- Second factor ----------------------------------------------------

  if (
    signIn.status === "needs_client_trust" ||
    signIn.status === "needs_second_factor"
  ) {
    const usesEmail =
      signIn.status === "needs_client_trust" || Boolean(emailSecondFactor);

    return (
      <AuthCard
        title="One more step"
        description={
          usesEmail
            ? "Enter the code we just emailed you."
            : "Enter the code from your authenticator app."
        }
      >
        <form action={handleSecondFactor} className="grid gap-4">
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
            {isBusy ? "Verifying…" : "Verify"}
          </Button>
          {usesEmail ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isBusy}
              onClick={() => void signIn.mfa.sendEmailCode()}
            >
              Send a new code
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={startOver}
            disabled={isBusy}
          >
            Start over
          </Button>
        </form>
      </AuthCard>
    );
  }

  // ---- Password ---------------------------------------------------------

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in with your email address."
      footer={
        <span>
          New here?{" "}
          <Link href={routes.signUp} className="text-foreground underline">
            Create an account
          </Link>
        </span>
      }
    >
      <form action={handlePassword} className="grid gap-4">
        <AuthFormErrors errors={errors.global} />

        <SocialAuth onGoogle={signInWithGoogle} disabled={isBusy} />
        <AuthField
          id="email"
          name="email"
          type="email"
          label="Email address"
          autoComplete="email"
          required
          error={errors.fields.identifier}
        />
        <AuthField
          id="password"
          name="password"
          type="password"
          label="Password"
          autoComplete="current-password"
          required
          error={errors.fields.password}
        />
        <Button type="submit" disabled={isBusy}>
          {isBusy ? "Signing in…" : "Continue"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setIsResetting(true);
          }}
          disabled={isBusy}
        >
          Forgot password?
        </Button>
      </form>
    </AuthCard>
  );
}
