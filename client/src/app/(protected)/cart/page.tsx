import type { Metadata } from "next";
import { HydrationBoundary } from "@tanstack/react-query";
import { requireUser } from "@/features/auth/server/guards";
import { CartView } from "@/features/cart/components/cart-view";
import { prefetchCart } from "@/features/cart/server/prefetch";
import { CheckoutSteps } from "@/features/orders/components/checkout-steps";
import { createServerQueryClient, dehydrateQueries } from "@/lib/query/server";

export const metadata: Metadata = { title: "Your cart" };

/**
 * The cart.
 *
 * Fetched on the server so the first paint has it, then handed to TanStack
 * Query, which owns it from hydration on. That is what makes the stepper feel
 * instant: every cart write answers with the whole recalculated cart and
 * writes it into the cache, so nothing has to re-render this route or make a
 * second request — and the header badge, reading the same cache entry, moves
 * with it.
 *
 * The lines are grouped by shop because that is how they will be ordered:
 * checkout splits the cart into one sub-order per vendor, each with its own
 * parcel and its own delivery charge.
 */
export default async function CartPage() {
  // `requireUser()` before the prefetch, not just in the layout: Next renders
  // a layout and its page concurrently, so without this the cart request goes
  // out while the guard is still deciding — and for a guest that is a
  // guaranteed 401 racing a redirect. It is `cache()`d, so it costs nothing.
  await requireUser();

  const queryClient = createServerQueryClient();
  await prefetchCart(queryClient);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="flex flex-col gap-4">
        <CheckoutSteps current="Cart" />
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Your cart
        </h1>
      </header>

      <HydrationBoundary state={dehydrateQueries(queryClient)}>
        <CartView />
      </HydrationBoundary>
    </div>
  );
}
