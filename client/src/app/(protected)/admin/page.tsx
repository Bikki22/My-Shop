import type { Metadata } from "next";
import { HydrationBoundary } from "@tanstack/react-query";
import { routes } from "@/config/routes";
import { PlatformDashboard } from "@/features/dashboard/components/platform-dashboard";
import { RangeTabs } from "@/features/dashboard/components/range-tabs";
import { parseAnalyticsRange } from "@/features/dashboard/lib/analytics-filters";
import { prefetchPlatformDashboard } from "@/features/dashboard/server/prefetch";
import {
  createServerQueryClient,
  dehydrateQueries,
} from "@/lib/query/server";

export const metadata: Metadata = {
  title: "Overview",
  description: "Trade, shops, customers and money across the marketplace.",
};

/**
 * The marketplace operator's dashboard.
 *
 * Prefetched on the server for the range in the URL, then handed to the
 * client cache — see the merchant dashboard for why both halves exist.
 */
export default async function AdminOverviewPage({
  searchParams,
}: PageProps<"/admin">) {
  const range = parseAnalyticsRange(await searchParams);

  const queryClient = createServerQueryClient();
  await prefetchPlatformDashboard(queryClient, range);

  return (
    <>
      <header className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Overview
          </h1>
          <p className="text-sm text-muted-foreground">
            How the marketplace is trading, and what it owes.
          </p>
        </div>
        <RangeTabs active={range} pathname={routes.admin.root} />
      </header>

      <HydrationBoundary state={dehydrateQueries(queryClient)}>
        <PlatformDashboard range={range} />
      </HydrationBoundary>
    </>
  );
}
