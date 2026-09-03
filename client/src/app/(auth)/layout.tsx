import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";

/**
 * Chrome for the sign-in/sign-up screens: no site header, just a centred card.
 *
 * The signed-in redirect lives here rather than in the proxy because Clerk
 * Core 3 deprecated path-matcher-based checks — this runs as part of rendering
 * the segment, so it can't be bypassed by a routing quirk.
 */
export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const { isAuthenticated } = await auth();

  // Signed-in users have no business on the sign-in/sign-up screens.
  if (isAuthenticated) {
    redirect(routes.home);
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
      <Link href={routes.home} className="text-lg font-semibold tracking-tight">
        {siteConfig.name}
      </Link>
      {children}
    </main>
  );
}
