import Link from "next/link";
import { StoreIcon, TruckIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DEFAULT_PRODUCT_FILTERS, productsHref } from "@/features/products/lib/product-filters";
import { formatPrice, pluralize } from "@/lib/format";
import type { CartGroup } from "../types";
import { CartItemRow } from "./cart-item-row";

/**
 * One shop's lines, with that shop's own delivery fee and total.
 *
 * The grouping is not cosmetic: checkout splits the cart by vendor into
 * sub-orders, each with its own parcel, its own delivery charge and its own
 * fulfilment status. Showing the cart any other way would misrepresent what
 * the shopper is about to buy.
 */
export function CartVendorGroup({ group }: { group: CartGroup }) {
  const shopName = group.vendorName ?? "Unavailable items";

  return (
    <section className="overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10">
      <header className="flex flex-wrap items-center gap-3 border-b bg-muted/40 px-4 py-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <StoreIcon className="size-3.5" aria-hidden />
        </span>

        <h2 className="text-sm font-semibold">
          {group.vendorId ? (
            <Link
              href={productsHref({
                ...DEFAULT_PRODUCT_FILTERS,
                vendor: group.vendorId,
              })}
              className="underline-offset-2 hover:underline"
            >
              {shopName}
            </Link>
          ) : (
            shopName
          )}
        </h2>

        {!group.vendorActive && group.vendorId ? (
          <Badge variant="destructive">Not selling</Badge>
        ) : null}

        <p className="ml-auto flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <TruckIcon className="size-3.5" aria-hidden />
          {group.shippingFee === 0
            ? "Free delivery"
            : `Delivery ${formatPrice(group.shippingFee)}`}
        </p>
      </header>

      <div>
        {group.items.map((item) => (
          <CartItemRow key={item.productId} item={item} />
        ))}
      </div>

      <footer className="flex items-center justify-between gap-3 border-t bg-muted/20 px-4 py-3 text-xs">
        <span className="text-muted-foreground">
          {pluralize(group.items.length, "item")} from this shop
        </span>
        <span className="font-mono font-semibold tabular-nums">
          {formatPrice(group.total)}
        </span>
      </footer>
    </section>
  );
}
