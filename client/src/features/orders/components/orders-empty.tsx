import Link from "next/link";
import { PackageOpenIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { ORDER_STATUS_LABELS } from "../lib/format";
import type { OrderStatus } from "../types";

/**
 * Shown when the history has nothing in it — either at all, or for the
 * status being filtered. Offers the way out rather than only reporting the
 * dead end, the same as the catalogue's empty grid.
 */
export function OrdersEmpty({ status }: { status: OrderStatus | null }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-16 text-center">
      <PackageOpenIcon className="size-8 text-muted-foreground" aria-hidden />
      <h2 className="font-heading text-base font-medium">
        {status
          ? `No ${ORDER_STATUS_LABELS[status].toLowerCase()} orders`
          : "No orders yet"}
      </h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        {status
          ? "Nothing in your history is at this stage right now."
          : "Once you place an order it appears here, with a tracker for each parcel."}
      </p>
      <Button
        render={<Link href={status ? routes.orders : routes.products} />}
        variant={status ? "outline" : "default"}
        size="lg"
      >
        {status ? "Show all orders" : "Start shopping"}
      </Button>
    </div>
  );
}
