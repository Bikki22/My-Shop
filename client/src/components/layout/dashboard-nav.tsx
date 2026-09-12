"use client";

import type { ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLock } from "@/components/layout/brand";
import { cn } from "@/lib/utils";

export interface DashboardLink {
  /** Typed, because `typedRoutes` validates every `Link href` against the
   *  routes that actually exist — a nav item pointing at a page nobody has
   *  written is a compile error rather than a 404 someone finds later. */
  href: Route;
  label: string;
  /** Rendered at 17px inside the rail. Optional so a section can add items
   *  before anyone has picked a glyph for them. */
  icon?: ReactNode;
  /**
   * Prefix matching is the default so `/seller/products/new` keeps
   * "Products" lit. The section root opts out — otherwise every child route
   * would also highlight the dashboard link, and two items would look
   * current at once.
   */
  exact?: boolean;
}

/**
 * The console rail shared by the merchant and platform areas.
 *
 * Navy, per the mockups — the consoles are a different room from the shop,
 * and the ground saying so before you read a word of it is most of what
 * makes an admin area feel like one. The current item is marked twice: a
 * lifted background, and the marigold bar inset down its leading edge.
 *
 * One component rather than two because the behaviour is identical and only
 * the link list differs — and because the two areas should not drift apart
 * visually as items are added to either.
 *
 * A `<nav>` of real links, like `AccountNav`: each destination is a URL, so
 * the back button, middle-click and bookmarks all work without this holding
 * any state of its own beyond reading the pathname.
 *
 * Below `lg` the rail becomes a scrolling strip. A full-height navy column
 * on a phone would spend the whole first screen on navigation.
 */
export function DashboardNav({
  links,
  label,
  subtitle,
  className,
}: {
  links: readonly DashboardLink[];
  /** Distinguishes the two navs for assistive tech on a page that has one. */
  label: string;
  /** Qualifies the mark in the rail head — "Vendor console", "Platform". */
  subtitle?: string;
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <div
      className={cn(
        "bg-ink lg:sticky lg:top-24 lg:flex lg:h-[calc(100vh-6rem)] lg:flex-col lg:p-5",
        className,
      )}
    >
      <div className="hidden pb-7 lg:block">
        <BrandLock subtitle={subtitle} inverted />
      </div>

      <nav
        aria-label={label}
        className="flex gap-1 overflow-x-auto p-3 lg:flex-col lg:overflow-visible lg:p-0"
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
                "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors outline-none",
                "focus-visible:ring-3 focus-visible:ring-ring/50",
                active
                  ? "bg-ink-soft text-white shadow-[inset_3px_0_0_var(--brand)]"
                  : "text-sidebar-foreground hover:bg-ink-soft hover:text-white",
              )}
            >
              {link.icon ? (
                <span aria-hidden className="[&_svg]:size-[1.0625rem]">
                  {link.icon}
                </span>
              ) : null}
              {link.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
