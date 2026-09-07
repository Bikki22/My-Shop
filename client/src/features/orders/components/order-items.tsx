import Link from "next/link";
import { routes } from "@/config/routes";
import { ProductImage } from "@/features/products/components/product-image";
import { formatPrice } from "@/lib/format";
import type { OrderItem } from "../types";

/**
 * The purchased lines of one sub-order.
 *
 * The name, image and price are the snapshot taken at checkout, not the
 * live product — so this is what the customer actually bought, even if the
 * listing has since changed or been withdrawn. The link is still offered
 * because "buy this again" is the common reason to click, and a dead
 * listing is answered by the product page's own `notFound()`.
 */
export function OrderItems({
  items,
  size = "md",
}: {
  items: OrderItem[];
  size?: "sm" | "md";
}) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.productId} className="flex items-center gap-3">
          <div
            className={
              size === "sm"
                ? "relative size-11 shrink-0 overflow-hidden rounded-lg bg-muted"
                : "relative size-14 shrink-0 overflow-hidden rounded-xl bg-muted"
            }
          >
            <ProductImage
              src={item.image}
              alt={item.name}
              sizes={size === "sm" ? "44px" : "56px"}
              className="object-cover"
            />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              <Link
                href={routes.product(item.productId)}
                className="underline-offset-2 hover:underline"
              >
                {item.name}
              </Link>
            </p>
            <p className="text-xs text-muted-foreground">
              {[item.brand, `Qty ${String(item.quantity)}`]
                .filter(Boolean)
                .join(" · ")}
              {item.quantity > 1 ? ` · ${formatPrice(item.price)} each` : ""}
            </p>
          </div>

          <p className="font-mono text-sm font-semibold tabular-nums">
            {formatPrice(item.lineTotal)}
          </p>
        </li>
      ))}
    </ul>
  );
}
