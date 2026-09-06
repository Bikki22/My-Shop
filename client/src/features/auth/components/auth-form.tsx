"use client";

import type { ComponentProps, ReactNode } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Shared chrome for the hand-rolled sign-in and sign-up forms.
 *
 * These screens are built on Clerk's `useSignIn`/`useSignUp` hooks rather
 * than `<SignIn />`/`<SignUp />` because the prebuilt components render
 * whichever identifiers the Clerk *instance* has enabled — there is no prop
 * to hide one. Owning the markup is the only way the set of fields a
 * customer is asked for lives in this repo and can be reviewed in a diff.
 */

/** The subset of Clerk's `FieldError` these forms actually render. */
export interface AuthFieldError {
  message: string;
}

export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
      {footer ? (
        <CardFooter className="justify-center text-sm text-muted-foreground">
          {footer}
        </CardFooter>
      ) : null}
    </Card>
  );
}

/**
 * A labelled input with its field-level Clerk error underneath.
 *
 * `aria-invalid` drives the destructive ring in `Input`'s variants, so the
 * error state is announced and styled from the same one prop.
 */
export function AuthField({
  id,
  label,
  error,
  ...inputProps
}: ComponentProps<"input"> & {
  id: string;
  label: string;
  error?: AuthFieldError | null;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} aria-invalid={error ? true : undefined} {...inputProps} />
      {error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : null}
    </div>
  );
}

/**
 * Errors Clerk could not attribute to a single field — a wrong password, a
 * locked account, a network failure. Rendering `null` for an empty list
 * keeps the caller free of conditionals.
 */
export function AuthFormErrors({
  errors,
}: {
  errors: readonly { message: string }[] | null;
}) {
  if (!errors || errors.length === 0) return null;

  return (
    <Alert variant="destructive">
      <AlertDescription>
        {errors.map((error) => (
          <p key={error.message}>{error.message}</p>
        ))}
      </AlertDescription>
    </Alert>
  );
}

/** Google's brand mark, inlined so the button needs no network request. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true" className="size-4">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

/**
 * The social half of both auth screens.
 *
 * Kept next to the email form rather than behind it: Clerk's prebuilt
 * components rendered these, so dropping them when the forms were
 * hand-rolled would quietly remove a way people already sign in.
 *
 * The caller supplies `onGoogle` because sign-in and sign-up start the same
 * redirect through different resources (`signIn.sso` vs `signUp.sso`) — the
 * button itself has no opinion about which.
 */
export function SocialAuth({
  onGoogle,
  disabled,
}: {
  onGoogle: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-4">
      <Button
        type="button"
        variant="outline"
        onClick={onGoogle}
        disabled={disabled}
      >
        <GoogleMark />
        Continue with Google
      </Button>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
