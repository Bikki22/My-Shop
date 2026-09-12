import type { Route } from "next";
import Link from "next/link";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";

/**
 * The navy foot the storefront lands on.
 *
 * Every link here points at a route that exists — the mockups list a fuller
 * set (gift cards, a help centre, a returns policy), but a footer full of
 * dead ends is worse design than a short one, so those arrive with the pages
 * they describe.
 */

interface FooterColumn {
  heading: string;
  links: readonly { label: string; href: Route }[];
}

const columns: readonly FooterColumn[] = [
  {
    heading: "Shop",
    links: [
      { label: "All products", href: routes.products },
      { label: "Your cart", href: routes.cart },
      { label: "Your orders", href: routes.orders },
    ],
  },
  {
    heading: "Sell",
    links: [
      { label: "Become a vendor", href: routes.sellerApply },
      { label: "Vendor console", href: routes.seller.root },
      { label: "Payouts", href: routes.seller.payouts },
    ],
  },
  {
    heading: "Account",
    links: [
      { label: "Your account", href: routes.account },
      { label: "Sign in", href: routes.signIn },
      { label: "Create an account", href: routes.signUp },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 bg-ink text-ink-muted">
      <div className="mx-auto w-full max-w-6xl px-4 pt-12 pb-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          <div className="flex flex-col gap-3.5">
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand font-heading text-[1.0625rem] leading-none font-bold text-brand-foreground"
              >
                {siteConfig.name.charAt(0).toUpperCase()}
              </span>
              <span className="font-heading text-[1.1875rem] leading-tight font-semibold tracking-tight text-ink-foreground">
                {siteConfig.name}
              </span>
            </div>
            <p className="max-w-xs text-sm leading-relaxed">
              {siteConfig.description}
            </p>
          </div>

          {columns.map((column) => (
            <div key={column.heading} className="flex flex-col gap-3">
              <h2 className="text-[0.8125rem] font-semibold text-ink-foreground">
                {column.heading}
              </h2>
              <ul className="flex flex-col gap-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm transition-colors outline-none hover:text-ink-foreground focus-visible:text-ink-foreground focus-visible:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-9 flex flex-col gap-3 border-t border-white/10 pt-5 text-xs sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {new Date().getFullYear()} {siteConfig.name}
          </span>
          {/* The payment methods the checkout actually offers. */}
          <span>Cash on Delivery · eSewa</span>
        </div>
      </div>
    </footer>
  );
}
