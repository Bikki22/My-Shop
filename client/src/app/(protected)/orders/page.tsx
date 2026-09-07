import type { Metadata } from "next";
import { TriangleAlertIcon } from "lucide-react";
import { AccountNav } from "@/components/layout/account-nav";
import { requireUser } from "@/features/auth/server/guards";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { OrderCard } from "@/features/orders/components/order-card";
import { OrderFilterTabs } from "@/features/orders/components/order-filter-tabs";
import { OrdersEmpty } from "@/features/orders/components/orders-empty";
import { OrdersPagination } from "@/features/orders/components/orders-pagination";
import { parseOrderFilters } from "@/features/orders/lib/order-filters";
import { listMyOrders } from "@/features/orders/server/orders";
import { pluralize } from "@/lib/format";

export const metadata: Metadata = {
  title: "My orders",
  description: "Track deliveries across every shop you have bought from.",
};

/**
 * The order history.
 *
 * The status filter and the page live in the URL and are queried on the
 * server, so a filtered history is shareable and reload-safe — the same
 * contract the catalogue keeps. There is no client state on this page at all.
 */
export default async function OrdersPage({
  searchParams,
}: PageProps<"/orders">) {
  // Before the read: a layout and its page render concurrently, so without
  // this a guest's request goes out while the layout's guard is still deciding.
  // `requireUser()` is `cache()`d, so it costs nothing.
  await requireUser();

  const filters = parseOrderFilters(await searchParams);
  const { page, error } = await listMyOrders(filters);

  const { total } = page.pagination;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          My orders
        </h1>
        <p className="text-sm text-muted-foreground">
          {error
            ? "Your order history is unavailable right now."
            : total === 0
              ? "Nothing here yet."
              : `${pluralize(total, "order")}${filters.status ? " matching this filter" : ""} — each shop's parcel is tracked on its own.`}
        </p>
      </header>

      <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:gap-8">
        <AccountNav className="lg:w-48 lg:shrink-0" />

        <main className="flex min-w-0 flex-1 flex-col gap-5">
          <OrderFilterTabs active={filters.status} />

          {error ? (
            <Alert variant="destructive">
              <TriangleAlertIcon />
              <AlertTitle>Could not load your orders</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : page.data.length === 0 ? (
            <OrdersEmpty status={filters.status} />
          ) : (
            <>
              <div className="flex flex-col gap-4">
                {page.data.map((order) => (
                  <OrderCard key={order._id} order={order} />
                ))}
              </div>
              <OrdersPagination page={page} filters={filters} />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
