"use client";

import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { ShoppingCartIcon } from "lucide-react";
import { routes } from "@/config/routes";
import { cn } from "@/lib/utils";
import { useCartCountsQuery } from "../hooks/use-cart-query";

/**
 * The header's cart link, with a live item count.
 *
 * A Client Component reading the shared query cache, which is the point: a
 * cart write anywhere in the app writes its response into that cache, so this
 * badge updates on the same tick as the cart page — no route refresh, no
 * second request. Adding from a product page moves the number immediately.
 *
 * Guests are skipped rather than answered with a 401: the header renders on
 * every page, and a guaranteed-failing request per page view is pure waste.
 */
export function CartLink() {
  const { isSignedIn } = useUser();
  const { data } = useCartCountsQuery({ enabled: Boolean(isSignedIn) });

  const totalQuantity = data?.totalQuantity ?? 0;

  return (
    <Link
      href={routes.cart}
      aria-label={
        totalQuantity > 0
          ? `Cart, ${String(totalQuantity)} item${totalQuantity === 1 ? "" : "s"}`
          : "Cart, empty"
      }
      className={cn(
        "relative inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors",
        "outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
      )}
    >
      <ShoppingCartIcon className="size-4" aria-hidden />

      {totalQuantity > 0 ? (
        <span
          aria-hidden
          className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[0.625rem] font-bold text-primary-foreground tabular-nums"
        >
          {/* Two digits is all the badge has room for; past that the exact
              number matters less than "a lot". */}
          {totalQuantity > 99 ? "99+" : totalQuantity}
        </span>
      ) : null}
    </Link>
  );
}
