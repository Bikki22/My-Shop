"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShoppingBagIcon, ZapIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { stockState } from "@/features/products/lib/format";
import { cn } from "@/lib/utils";
import { useCart } from "../hooks/use-cart";
import { QuantityStepper } from "./quantity-stepper";

/**
 * The product page's buy controls: a quantity stepper, "Add to cart", and
 * "Buy now" — which is the same write followed by a jump to checkout.
 *
 * A cart lives on the server against a user, so there is nothing useful to
 * do with a guest's click. Rather than let the request come back 401 and
 * surface "Unauthorized", this sends them to sign in and says why.
 */
export function AddToCart({
  productId,
  stock,
  className,
}: {
  productId: string;
  stock: number;
  className?: string;
}) {
  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const { addItem, isPendingFor, isPending } = useCart();
  const [quantity, setQuantity] = useState(1);

  const soldOut = stockState(stock) === "out";
  const busy = isPendingFor(productId);

  const requireSignIn = (): boolean => {
    if (isSignedIn) return false;
    toast.info("Sign in to start a cart");
    router.push(routes.signIn);
    return true;
  };

  const add = async () => {
    if (requireSignIn()) return;
    await addItem(productId, quantity);
  };

  const buyNow = async () => {
    if (requireSignIn()) return;
    // Only leave for checkout if the line actually landed — otherwise the
    // shopper arrives at a checkout that is missing the thing they wanted.
    if (await addItem(productId, quantity)) {
      router.push(routes.checkout);
    }
  };

  if (soldOut) {
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        <Button size="lg" disabled className="h-12 w-full">
          Sold out
        </Button>
        <p className="text-xs text-muted-foreground">
          This listing has no units left. The shop may restock it.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-center gap-4">
        <QuantityStepper
          value={quantity}
          onChange={setQuantity}
          max={stock}
          size="lg"
          disabled={busy}
        />
        <p className="text-xs font-medium text-muted-foreground">
          {stock} available
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        {/* `!isLoaded` rather than a spinner: Clerk resolves in a blink, and
            a button that changes meaning mid-click is worse than one that is
            briefly inert. */}
        <Button
          size="lg"
          className="h-12 flex-1 basis-40"
          onClick={() => void add()}
          disabled={busy || !isLoaded}
        >
          <ShoppingBagIcon data-icon="inline-start" aria-hidden />
          {busy ? "Adding…" : "Add to cart"}
        </Button>

        <Button
          size="lg"
          variant="secondary"
          className="h-12 flex-1 basis-32"
          onClick={() => void buyNow()}
          disabled={isPending || !isLoaded}
        >
          <ZapIcon data-icon="inline-start" aria-hidden />
          Buy now
        </Button>
      </div>
    </div>
  );
}
