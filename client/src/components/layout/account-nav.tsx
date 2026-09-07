"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { routes } from "@/config/routes";
import { cn } from "@/lib/utils";

/**
 * The sidebar the design puts next to the order history.
 *
 * It lists only what exists. The mock also offers Addresses, Payment
 * methods, Wishlist and Reviews — none of which the API has an endpoint for,
 * and a nav item that leads to a 404 is worse than one that is absent.
 */
const LINKS = [
  { href: routes.orders, label: "My orders" },
  { href: routes.cart, label: "Cart" },
  { href: routes.account, label: "Account settings" },
] as const;

export function AccountNav({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Account"
      className={cn("flex gap-1 overflow-x-auto lg:flex-col", className)}
    >
      {LINKS.map((link) => {
        // Prefix match so `/orders/<id>` keeps "My orders" highlighted.
        const active =
          pathname === link.href || pathname.startsWith(`${link.href}/`);

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
