import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { BrandLock } from "@/components/layout/brand";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";

/**
 * Chrome for the sign-in/sign-up screens: the split from `design/login.html`
 * — a navy panel carrying the brand and what the marketplace is for, beside
 * the form itself on paper.
 *
 * The panel is hidden below `lg` rather than stacked. On a phone the only
 * thing on screen should be the form; a full-height marketing panel above it
 * would push the first field under the fold.
 *
 * The signed-in redirect lives here rather than in the proxy because Clerk
 * Core 3 deprecated path-matcher-based checks — this runs as part of rendering
 * the segment, so it can't be bypassed by a routing quirk.
 */

/** What the marketplace offers, rather than invented headline numbers. */
const propositions = [
  {
    title: "Every shop is reviewed",
    body: "Vendors are approved by hand before a single listing goes live.",
  },
  {
    title: "Tracked per vendor",
    body: "An order split across shops is tracked and updated separately.",
  },
  {
    title: "Pay how you like",
    body: "Cash on Delivery, or settle up front with eSewa.",
  },
];

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const { isAuthenticated } = await auth();

  // Signed-in users have no business on the sign-in/sign-up screens.
  if (isAuthenticated) {
    redirect(routes.home);
  }

  return (
    <div className="grid flex-1 lg:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-ink bg-weave p-14 lg:flex">
        <BrandLock inverted />

        <p className="max-w-md font-heading text-[1.75rem] leading-snug font-medium text-ink-foreground">
          Every purchase here carries{" "}
          <em className="text-brand">a name, a shop, a maker</em> behind it.
        </p>

        <ul className="flex flex-col gap-5">
          {propositions.map((proposition) => (
            <li key={proposition.title} className="flex flex-col gap-1">
              <span className="text-[0.8125rem] font-semibold text-ink-foreground">
                {proposition.title}
              </span>
              <span className="max-w-sm text-[0.8125rem] leading-relaxed text-ink-muted">
                {proposition.body}
              </span>
            </li>
          ))}
        </ul>
      </aside>

      <main className="flex flex-col items-center justify-center gap-8 px-4 py-14">
        {/* The mark repeats on the form side because the panel beside it is
            gone below `lg`, and a sign-in screen with no brand on it is a
            phishing page as far as anyone can tell. */}
        <BrandLock className="lg:hidden" />
        {children}
        <p className="max-w-sm text-center text-xs text-muted-foreground">
          {siteConfig.description}
        </p>
      </main>
    </div>
  );
}
