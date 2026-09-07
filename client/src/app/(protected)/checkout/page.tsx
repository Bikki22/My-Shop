import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HydrationBoundary } from "@tanstack/react-query";
import { TriangleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { routes } from "@/config/routes";
import { requireUser } from "@/features/auth/server/guards";
import { seedCart } from "@/features/cart/cart-cache";
import { getCart } from "@/features/cart/server/cart";
import { CheckoutForm } from "@/features/orders/components/checkout-form";
import { CheckoutSteps } from "@/features/orders/components/checkout-steps";
import { createServerQueryClient, dehydrateQueries } from "@/lib/query/server";

export const metadata: Metadata = { title: "Checkout" };

/**
 * Checkout.
 *
 * The cart is **awaited** here rather than prefetched, because this page has
 * to decide something before it renders: an empty cart is bounced back, and so
 * is one with problems (a deleted product, a closed shop, a line that now
 * exceeds stock). Those can only be fixed on the cart page, and letting the
 * shopper fill in an address first only to be refused by `POST /orders` wastes
 * their time.
 *
 * Since the cart is already in hand, it is seeded into the query cache rather
 * than fetched a second time — the form reads it from there, under the same
 * key the cart page uses.
 */
export default async function CheckoutPage() {
  // Before the cart read, not alongside it: Next renders a layout and its page
  // concurrently, so a `Promise.all` here would send the cart request while the
  // guard was still deciding — for a guest, a guaranteed 401 racing a redirect.
  // `requireUser()` is `cache()`d, so this costs nothing.
  const user = await requireUser();
  const { cart, error } = await getCart();

  if (error) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-12">
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>Checkout is unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (cart.summary.itemCount === 0 || cart.summary.hasIssues) {
    redirect(routes.cart);
  }

  const queryClient = createServerQueryClient();
  seedCart(queryClient, cart);

  const defaultName = [user.firstName, user.lastName].filter(Boolean).join(" ");

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="flex flex-col gap-4">
        <CheckoutSteps current="Checkout" />
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Checkout
        </h1>
      </header>

      <div className="mt-6">
        <HydrationBoundary state={dehydrateQueries(queryClient)}>
          <CheckoutForm defaultName={defaultName} />
        </HydrationBoundary>
      </div>
    </div>
  );
}
