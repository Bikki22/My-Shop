"use client";

import { TriangleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { isApiError } from "@/lib/api";
import { pluralize } from "@/lib/format";
import { useCartQuery } from "../hooks/use-cart-query";
import { useCart } from "../hooks/use-cart";
import { CartEmpty } from "./cart-empty";
import { CartSummary } from "./cart-summary";
import { CartVendorGroup } from "./cart-vendor-group";
import { ClearCartButton } from "./clear-cart-button";

/**
 * Everything on the cart page below the title.
 *
 * One component reads the query and passes the cart down, rather than each
 * piece reading it: they would all get the same cache entry anyway, and a
 * single read keeps the empty / error / loading decision in one place instead
 * of three components each guessing what to render when there is no cart.
 *
 * Prefetched and hydrated by the page, so the skeleton below is for the cases
 * nothing primed the cache — a soft navigation from another route with a
 * stale-enough cache, or a refetch that failed and recovered.
 */
export function CartView() {
  const { data: cart, error, isPending } = useCartQuery();
  // `isPending` here is the *write* in flight, which is what makes the totals
  // provisional — see `useCart`, which deliberately does not guess money.
  const { isPending: isWriting } = useCart();

  if (isPending) {
    return (
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-56 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  if (error || !cart) {
    return (
      <Alert variant="destructive" className="mt-6">
        <TriangleAlertIcon />
        <AlertTitle>Could not load your cart</AlertTitle>
        <AlertDescription>
          {isApiError(error) ? error.message : "Please try again in a moment."}
        </AlertDescription>
      </Alert>
    );
  }

  const { summary } = cart;

  if (summary.itemCount === 0) {
    return (
      <>
        <p className="mt-1 text-sm text-muted-foreground">Nothing in here yet.</p>
        <div className="mt-6">
          <CartEmpty />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {summary.vendorCount > 1
            ? `${pluralize(summary.totalQuantity, "item")} from ${pluralize(summary.vendorCount, "shop")} — shipped and tracked separately`
            : `${pluralize(summary.totalQuantity, "item")} ready to order`}
        </p>
        <ClearCartButton />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <div className="flex min-w-0 flex-col gap-4">
          {cart.groups.map((group) => (
            <CartVendorGroup
              key={group.vendorId ?? "unavailable"}
              group={group}
            />
          ))}
        </div>

        <CartSummary summary={summary} isRecalculating={isWriting} />
      </div>
    </>
  );
}
