"use client";

import Link from "next/link";
import { AlertTriangleIcon, Trash2Icon } from "lucide-react";
import { routes } from "@/config/routes";
import { ProductImage } from "@/features/products/components/product-image";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCart } from "../hooks/use-cart";
import {
  CART_ISSUE_MESSAGES,
  cartItemIssue,
  type CartItem,
} from "../types";
import { QuantityStepper } from "./quantity-stepper";

/**
 * One cart line: thumbnail, name, stepper, remove, line total.
 *
 * A client component because the stepper and Remove write to the server;
 * everything it renders comes from the parent's server-fetched cart, so it
 * holds no state of its own beyond what `useCart` tracks.
 */
export function CartItemRow({ item }: { item: CartItem }) {
  const { setQuantity, removeItem, isPendingFor } = useCart();

  const issue = cartItemIssue(item);
  const busy = isPendingFor(item.productId);
  // A deleted product has no page left to link to, and no name to show.
  const name = item.name ?? "This product is no longer listed";

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b p-4 last:border-b-0 sm:flex-row sm:items-center sm:gap-4",
        busy && "opacity-60",
      )}
    >
      <div className="relative size-19 shrink-0 overflow-hidden rounded-xl bg-muted">
        <ProductImage
          src={item.image}
          alt={name}
          sizes="76px"
          className={cn("object-cover", !item.isAvailable && "grayscale")}
        />
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-medium">
          {item.isAvailable ? (
            <Link
              href={routes.product(item.productId)}
              className="underline-offset-2 hover:underline"
            >
              {name}
            </Link>
          ) : (
            <span className="text-muted-foreground">{name}</span>
          )}
        </h3>

        <p className="mt-0.5 text-xs text-muted-foreground">
          {[item.brand, item.isAvailable ? formatPrice(item.price) : null]
            .filter(Boolean)
            .join(" · ")}
        </p>

        {issue ? (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-destructive">
            <AlertTriangleIcon className="size-3.5 shrink-0" aria-hidden />
            {CART_ISSUE_MESSAGES[issue]}
          </p>
        ) : null}

        <div className="mt-2.5 flex items-center gap-3">
          {/* No stepper for a line that cannot be bought at any quantity —
              the only useful action left on it is Remove. */}
          {item.isAvailable ? (
            <QuantityStepper
              value={item.quantity}
              onChange={(quantity) => void setQuantity(item.productId, quantity)}
              max={item.stock}
              disabled={busy}
              label={`quantity of ${name}`}
            />
          ) : null}

          <button
            type="button"
            onClick={() => void removeItem(item.productId)}
            disabled={busy}
            className="inline-flex items-center gap-1 text-xs font-semibold text-destructive underline-offset-2 outline-none hover:underline disabled:opacity-50 focus-visible:underline"
          >
            <Trash2Icon className="size-3.5" aria-hidden />
            Remove
          </button>
        </div>
      </div>

      <div className="text-right sm:min-w-25">
        <p className="font-mono text-sm font-bold tabular-nums">
          {formatPrice(item.lineTotal)}
        </p>
        {item.quantity > 1 && item.isAvailable ? (
          <p className="font-mono text-xs text-muted-foreground">
            {item.quantity} × {formatPrice(item.price)}
          </p>
        ) : null}
      </div>
    </div>
  );
}
