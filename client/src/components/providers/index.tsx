import { ClerkProvider } from "@clerk/nextjs";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { routes } from "@/config/routes";
import { CurrentUserProvider } from "@/features/auth/components/current-user-provider";
import { getCurrentUser } from "@/features/auth/server/current-user";
import { QueryProvider } from "@/lib/query/provider";
import { ThemeProvider } from "./theme-provider";

/**
 * The app-wide provider stack, assembled in one place so the root layout
 * stays a description of the document rather than a pile of wrappers.
 *
 * `getCurrentUser()` runs here so every component — server or client — can
 * read the app's user record (role, status) without its own request. It's
 * `cache()`d per render, and returns `null` for guests without calling the
 * API at all.
 */
export async function AppProviders({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  return (
    <ClerkProvider
      signInUrl={routes.signIn}
      signUpUrl={routes.signUp}
      signInFallbackRedirectUrl={routes.home}
      signUpFallbackRedirectUrl={routes.home}
    >
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        {/* App-wide, above the routes: the header's cart badge and the cart
            page have to share one cache, and a provider scoped to `/cart`
            would give them two. */}
        <QueryProvider>
          <CurrentUserProvider user={user}>{children}</CurrentUserProvider>
        </QueryProvider>
        <Toaster position="top-right" richColors />
      </ThemeProvider>
    </ClerkProvider>
  );
}
