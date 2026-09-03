import { clerkMiddleware } from "@clerk/nextjs/server";

/**
 * Next.js 16 renamed the `middleware` file convention to `proxy`. The export
 * must be named `proxy` or be the default export; `clerkMiddleware()` returns
 * a plain Next middleware function, so it slots straight in.
 *
 * Its only job is to attach the Clerk session to the request so `auth()` works
 * downstream. It deliberately does no path-based route protection:
 * `createRouteMatcher` is deprecated in Clerk Core 3 because matcher patterns
 * can diverge from how Next actually routes a request, which silently leaves
 * protected resources reachable.
 *
 * Access is enforced where the data is read instead — see
 * `features/auth/server/guards.ts`, called from every protected layout.
 */
export default clerkMiddleware();

export const config = {
  matcher: [
    // Everything except Next internals and static assets, unless the request
    // carries search params (those can still be dynamic routes).
    "/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
  ],
};
