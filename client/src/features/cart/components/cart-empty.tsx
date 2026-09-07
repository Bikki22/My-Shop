import Link from "next/link";
import { ShoppingCartIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";

export function CartEmpty() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-20 text-center">
      <ShoppingCartIcon className="size-8 text-muted-foreground" aria-hidden />
      <h2 className="font-heading text-base font-medium">Your cart is empty</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Browse the marketplace and add something you like — items from
        different shops can go in the same order.
      </p>
      <Button render={<Link href={routes.products} />} size="lg">
        Start shopping
      </Button>
    </div>
  );
}
