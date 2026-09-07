import type { Metadata } from "next";
import { TriangleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatCard, StatGrid } from "@/features/dashboard/components/stat-card";
import { getMyPayouts } from "@/features/payouts/server/payouts";
import { PAYOUT_STATUS_LABELS } from "@/features/payouts/types";
import { NoShopPanel } from "@/features/vendors/components/no-shop-panel";
import { getMyVendor } from "@/features/vendors/server/vendors";
import { formatDate, formatPrice, pluralize } from "@/lib/format";

export const metadata: Metadata = {
  title: "Payouts",
  description: "What your shop is owed, and what has been sent.",
};

const PAGE_SIZE = 20;

/**
 * The shop's money.
 *
 * Two things on one page because they answer different questions: the balance
 * is what is owed *now*, split by how far each parcel's money has got, and
 * the table is the history of transfers already made. Neither is derivable
 * from the other.
 */
export default async function SellerPayoutsPage({
  searchParams,
}: PageProps<"/seller/payouts">) {
  const params = await searchParams;
  const shop = await getMyVendor();

  if (!shop) {
    return <NoShopPanel />;
  }

  const rawPage = params["page"];
  const page = Number(Array.isArray(rawPage) ? rawPage[0] : rawPage) || 1;

  const { balance, page: result, error } = await getMyPayouts({
    page,
    limit: PAGE_SIZE,
  });

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Payouts
        </h1>
        <p className="text-sm text-muted-foreground">
          Money moves once a parcel is delivered. Transfers are made by the
          marketplace, in batches.
        </p>
      </header>

      {error ? (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>Could not load your payouts</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {balance ? (
        <StatGrid>
          <StatCard
            label="Ready to be paid"
            value={formatPrice(balance.payable)}
            hint={`${pluralize(balance.counts.PAYABLE, "parcel")} cleared`}
          />
          <StatCard
            label="On its way"
            value={formatPrice(balance.processing)}
            hint="A transfer is in progress"
          />
          <StatCard
            label="Not yet owed"
            value={formatPrice(balance.pending)}
            hint="Sold, not yet delivered"
          />
          <StatCard
            label="Paid to date"
            value={formatPrice(balance.paid)}
            hint={
              balance.reversed > 0
                ? `${formatPrice(balance.reversed)} reversed`
                : undefined
            }
          />
        </StatGrid>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-base font-medium">Transfers</h2>

        {result.data.length === 0 ? (
          <p className="rounded-xl bg-card px-6 py-12 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
            No transfers yet. The first one happens after your first delivery
            clears.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Parcels</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.data.map((payout) => (
                  <TableRow key={payout._id}>
                    <TableCell className="font-medium">
                      {payout.payoutNumber}
                      {payout.reference ? (
                        <span className="block text-xs text-muted-foreground">
                          {payout.reference}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(payout.createdAt)}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {payout.subOrderCount}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          payout.status === "PAID"
                            ? "secondary"
                            : payout.status === "FAILED"
                              ? "destructive"
                              : "outline"
                        }
                      >
                        {PAYOUT_STATUS_LABELS[payout.status]}
                      </Badge>
                      {payout.failureReason ? (
                        <span className="block text-xs text-muted-foreground">
                          {payout.failureReason}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPrice(payout.netAmount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </>
  );
}
