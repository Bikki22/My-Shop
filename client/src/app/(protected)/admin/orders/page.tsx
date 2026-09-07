import type { Metadata } from "next";
import Link from "next/link";
import { TriangleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { routes } from "@/config/routes";
import {
  OrderStatusBadge,
  PaymentStatusBadge,
} from "@/features/orders/components/order-status-badge";
import { listAdminOrders } from "@/features/orders/server/queues";
import { ORDER_STATUSES } from "@/features/orders/types";
import { formatDate, formatPrice, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Orders",
  description: "Every order placed on the marketplace.",
};

const PAGE_SIZE = 20;

/**
 * The marketplace-wide order list.
 *
 * One row per customer *order*, not per parcel — the parcel-level view is the
 * merchant's queue, and staff looking here are usually chasing an order
 * number a customer quoted, which spans every shop it was split across.
 */
export default async function AdminOrdersPage({
  searchParams,
}: PageProps<"/admin/orders">) {
  const params = await searchParams;

  const rawStatus = params["status"];
  const statusParam = Array.isArray(rawStatus) ? rawStatus[0] : rawStatus;
  const status = ORDER_STATUSES.find((value) => value === statusParam) ?? null;

  const rawNumber = params["orderNumber"];
  const orderNumber =
    (Array.isArray(rawNumber) ? rawNumber[0] : rawNumber) ?? "";
  const rawPage = params["page"];
  const page = Number(Array.isArray(rawPage) ? rawPage[0] : rawPage) || 1;

  const { page: result, error } = await listAdminOrders({
    status,
    orderNumber: orderNumber || undefined,
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
            ? "Orders are unavailable right now."
            : `${pluralize(result.pagination.total, "order")} on the marketplace.`}
        </p>
      </header>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <nav aria-label="Filter orders" className="flex flex-wrap gap-2">
          {[null, ...ORDER_STATUSES].map((value) => {
            const current = value === status;
            return (
              <Link
                key={value ?? "all"}
                href={
                  value
                    ? `${routes.admin.orders}?status=${value}`
                    : routes.admin.orders
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

        <form action={routes.admin.orders} className="flex max-w-xs gap-2">
          <Input
            name="orderNumber"
            type="search"
            defaultValue={orderNumber}
            placeholder="ORD-20260901-…"
            aria-label="Find by order number"
          />
          <Button type="submit" variant="outline">
            Find
          </Button>
        </form>
      </div>

      {error ? (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>Could not load orders</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : result.data.length === 0 ? (
        <p className="rounded-xl bg-card px-6 py-12 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
          No orders match this view.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Placed</TableHead>
                <TableHead>Split</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.map((order) => (
                <TableRow key={order._id}>
                  <TableCell className="font-medium">
                    {order.orderNumber}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(order.placedAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {pluralize(order.itemCount, "item")} ·{" "}
                    {pluralize(order.vendorCount, "shop")}
                  </TableCell>
                  <TableCell>
                    <OrderStatusBadge status={order.status} />
                  </TableCell>
                  <TableCell>
                    <PaymentStatusBadge status={order.paymentStatus} />
                    <span className="block text-xs text-muted-foreground">
                      {order.paymentMethod}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPrice(order.pricing.grandTotal)}
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
