import type { Metadata } from "next";
import Link from "next/link";
import { TriangleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { routes } from "@/config/routes";
import { OrderStatusBadge } from "@/features/orders/components/order-status-badge";
import { listVendorQueue } from "@/features/orders/server/queues";
import { ORDER_STATUSES } from "@/features/orders/types";
import { NoShopPanel } from "@/features/vendors/components/no-shop-panel";
import { getMyVendor } from "@/features/vendors/server/vendors";
import { formatDate, formatPrice, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Orders",
  description: "Parcels your shop has to pack and send.",
};

const PAGE_SIZE = 20;

/**
 * The shop's fulfilment queue.
 *
 * One row per *parcel*, not per order: a customer's basket split across three
 * shops is three parcels, and this shop is only responsible for its own. The
 * money column is what the shop earns, not what the customer paid.
 */
export default async function SellerOrdersPage({
  searchParams,
}: PageProps<"/seller/orders">) {
  const params = await searchParams;
  const shop = await getMyVendor();

  if (!shop) {
    return <NoShopPanel />;
  }

  const rawStatus = params["status"];
  const statusParam = Array.isArray(rawStatus) ? rawStatus[0] : rawStatus;
  const status = ORDER_STATUSES.find((value) => value === statusParam) ?? null;
  const rawPage = params["page"];
  const page = Number(Array.isArray(rawPage) ? rawPage[0] : rawPage) || 1;

  const { page: result, error } = await listVendorQueue({
    status,
    page,
    limit: PAGE_SIZE,
  });

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Orders
        </h1>
        <p className="text-sm text-muted-foreground">
          {error
            ? "Your queue is unavailable right now."
            : result.pagination.total === 0
              ? "Nothing to pack."
              : `${pluralize(result.pagination.total, "parcel")} to fulfil.`}
        </p>
      </header>

      {/* Real links, like the customer history's filter chips: a filtered
          queue is a URL, so it stays shareable and reload-safe. */}
      <nav aria-label="Filter parcels" className="flex flex-wrap gap-2">
        {[null, ...ORDER_STATUSES].map((value) => {
          const current = value === status;
          return (
            <Link
              key={value ?? "all"}
              href={
                value
                  ? `${routes.seller.orders}?status=${value}`
                  : routes.seller.orders
              }
              aria-current={current ? "page" : undefined}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors outline-none",
                "focus-visible:ring-3 focus-visible:ring-ring/50",
                current
                  ? "border-primary bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {value ? value.charAt(0) + value.slice(1).toLowerCase() : "All"}
            </Link>
          );
        })}
      </nav>

      {error ? (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>Could not load your queue</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : result.data.length === 0 ? (
        <p className="rounded-xl bg-card px-6 py-12 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
          No parcels {status ? "in this state" : "yet"}.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Parcel</TableHead>
                <TableHead>Placed</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">You earn</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.map((subOrder) => (
                <TableRow key={subOrder._id}>
                  <TableCell>
                    <Link
                      href={routes.seller.order(subOrder._id)}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {subOrder.subOrderNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(subOrder.placedAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {pluralize(subOrder.items.length, "item")}
                  </TableCell>
                  <TableCell>
                    <OrderStatusBadge status={subOrder.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPrice(subOrder.earnings.vendorEarning)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
