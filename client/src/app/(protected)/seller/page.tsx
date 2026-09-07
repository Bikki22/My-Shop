import type { Metadata } from "next";
import { HydrationBoundary } from "@tanstack/react-query";
import { routes } from "@/config/routes";
import { RangeTabs } from "@/features/dashboard/components/range-tabs";
import { SellerDashboard } from "@/features/dashboard/components/seller-dashboard";
import { parseAnalyticsRange } from "@/features/dashboard/lib/analytics-filters";
import { prefetchSellerDashboard } from "@/features/dashboard/server/prefetch";
import {
  createServerQueryClient,
  dehydrateQueries,
} from "@/lib/query/server";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Sales, earnings and stock for your shop.",
};

/**
 * The merchant's dashboard.
 *
 * Rendered on the server *and* driven by the client cache: the range is a URL
 * parameter, so the page is prefetched with that range's data and the browser
 * hydrates straight onto it. Switching ranges after that is a cache read
 * rather than a round trip — and the previous figures stay on screen while a
 * new range loads instead of the grid collapsing to skeletons.
 */
export default async function SellerDashboardPage({
  searchParams,
}: PageProps<"/seller">) {
  const range = parseAnalyticsRange(await searchParams);

  const queryClient = createServerQueryClient();
  await prefetchSellerDashboard(queryClient, range);

  return (
    <>
      <header className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            How your shop is trading, and what you are owed.
          </p>
        </div>
        <RangeTabs active={range} pathname={routes.seller.root} />
      </header>

      <HydrationBoundary state={dehydrateQueries(queryClient)}>
        <SellerDashboard range={range} />
      </HydrationBoundary>
    </>
  );
}
