"use client";

import { useClerk, useSignIn, useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { routes } from "@/config/routes";

/**
 * Where Google (and any future social provider) drops the browser back.
 *
 * Clerk cannot know in advance whether a social redirect is a sign-in or a
 * sign-up — the same Google button does both — so this page inspects the
 * client afterwards and finalizes whichever one actually happened. That
 * ambiguity is why it lives here rather than under `/sign-in`.
 *
 * It sits outside the `(auth)` route group on purpose: that layout redirects
 * anyone with a session straight to the home page, which would race the
 * finalize below and strand a user mid-handshake.
 */
export default function SsoCallbackPage() {
  const clerk = useClerk();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const router = useRouter();
  const hasRun = useRef(false);

  useEffect(() => {
    const finalizeSignIn = async () => {
      await signIn.finalize({
        navigate: ({ decorateUrl }) => {
          window.location.href = decorateUrl(routes.home);
        },
      });
    };

    const finalizeSignUp = async () => {
      await signUp.finalize({
        navigate: ({ decorateUrl }) => {
          window.location.href = decorateUrl(routes.home);
        },
      });
    };

    void (async () => {
      // Activating a session re-renders this page; without the guard the
      // whole handshake would run a second time against stale state.
      if (!clerk.loaded || hasRun.current) return;
      hasRun.current = true;

      if (signIn.status === "complete") {
        await finalizeSignIn();
        return;
      }

      // Google returned an account that already exists here, so what began as
      // a sign-up is really a sign-in.
      if (signUp.isTransferable) {
        await signIn.create({ transfer: true });
        // `create()` mutates the resource in place, so the narrowing TypeScript
        // did at the `=== "complete"` check above no longer describes it.
        const status = signIn.status as typeof signIn.status | "complete";
        if (status === "complete") {
          await finalizeSignIn();
          return;
        }
        router.push(routes.signIn);
        return;
      }

      // ...and the mirror image: a first-time Google account needs creating.
      if (signIn.isTransferable) {
        await signUp.create({ transfer: true });
        if (signUp.status === "complete") {
          await finalizeSignUp();
          return;
        }
        // Clerk still wants something we didn't collect. The sign-up screen
        // reads `missingFields` and explains what.
        router.push(routes.signUp);
        return;
      }

      if (signUp.status === "complete") {
        await finalizeSignUp();
        return;
      }

      // A second factor or a forced password change: the sign-in screen owns
      // both of those, and picks them up from the same client state.
      if (
        signIn.status === "needs_second_factor" ||
        signIn.status === "needs_new_password" ||
        signIn.status === "needs_first_factor"
      ) {
        router.push(routes.signIn);
        return;
      }

      // The Google account was already signed in on this device. There is no
      // attempt to finalize, so activate the existing session directly.
      const sessionId =
        signIn.existingSession?.sessionId ?? signUp.existingSession?.sessionId;
      if (sessionId) {
        await clerk.setActive({
          session: sessionId,
          navigate: ({ decorateUrl }) => {
            window.location.href = decorateUrl(routes.home);
          },
        });
        return;
      }

      // Nothing recognisable came back — send them somewhere they can retry
      // rather than leaving a permanent spinner.
      router.push(routes.signIn);
    })();
  }, [clerk, signIn, signUp, router]);

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <p className="text-sm text-muted-foreground">Finishing sign-in…</p>
      {/* A social sign-in that turns into a sign-up can still be asked for a
          captcha, and Clerk needs this node present to render it. */}
      <div id="clerk-captcha" />
    </main>
  );
}
