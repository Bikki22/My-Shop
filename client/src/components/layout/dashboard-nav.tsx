"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface DashboardLink {
  /** Typed, because `typedRoutes` validates every `Link href` against the
   *  routes that actually exist — a nav item pointing at a page nobody has
   *  written is a compile error rather than a 404 someone finds later. */
  href: Route;
  label: string;
  /**
   * Prefix matching is the default so `/seller/products/new` keeps
   * "Products" lit. The section root opts out — otherwise every child route
   * would also highlight the dashboard link, and two items would look
   * current at once.
   */
  exact?: boolean;
}

/**
 * The sidebar shared by the merchant and platform areas.
 *
 * One component rather than two because the behaviour is identical and only
 * the link list differs — and because the two areas should not drift apart
 * visually as items are added to either.
 *
 * A `<nav>` of real links, like `AccountNav`: each destination is a URL, so
 * the back button, middle-click and bookmarks all work without this holding
 * any state of its own beyond reading the pathname.
 */
export function DashboardNav({
  links,
  label,
  className,
}: {
  links: readonly DashboardLink[];
  /** Distinguishes the two navs for assistive tech on a page that has one. */
  label: string;
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label={label}
      className={cn("flex gap-1 overflow-x-auto lg:flex-col", className)}
    >
      {links.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(`${link.href}/`);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-lg px-3.5 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors outline-none",
              "focus-visible:ring-3 focus-visible:ring-ring/50",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
