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
import {
  SettlePayoutButtons,
  StartPayoutButton,
} from "@/features/payouts/components/payout-actions";
import { getAdminPayouts } from "@/features/payouts/server/payouts";
import { PAYOUT_STATUS_LABELS } from "@/features/payouts/types";
import { formatDate, formatPrice, pluralize } from "@/lib/format";

export const metadata: Metadata = {
  title: "Payouts",
  description: "What the marketplace owes its shops, and what it has sent.",
};

const PAGE_SIZE = 20;

/**
 * The platform's payout screen.
 *
 * Two tables, in the order the work happens: who is owed money right now, and
 * then the ledger of transfers already made. The queue is sorted largest
 * first by the server, but the ageing column is the one that matters — a
 * small debt outstanding for six weeks is a worse problem than a large one
 * from yesterday.
 */
export default async function AdminPayoutsPage({
  searchParams,
}: PageProps<"/admin/payouts">) {
  const params = await searchParams;
  const rawPage = params["page"];
  const page = Number(Array.isArray(rawPage) ? rawPage[0] : rawPage) || 1;

  const { payable, page: result, error } = await getAdminPayouts({
    page,
    limit: PAGE_SIZE,
  });

  const owed = payable.reduce((sum, shop) => sum + shop.amount, 0);

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Payouts
        </h1>
        <p className="text-sm text-muted-foreground">
          {error
            ? "Payout data is unavailable right now."
            : payable.length === 0
              ? "Nothing is owed — every cleared sale has been paid."
              : `${formatPrice(owed)} owed across ${pluralize(payable.length, "shop")}.`}
        </p>
      </header>

      {error ? (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>Could not load payouts</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {payable.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-base font-medium">Owed now</h2>
          <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shop</TableHead>
                  <TableHead>Parcels</TableHead>
                  <TableHead>Oldest sale</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payable.map((shop) => (
                  <TableRow key={shop.vendor}>
                    <TableCell className="font-medium">{shop.name}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {shop.subOrderCount}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(shop.oldestPlacedAt)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPrice(shop.amount)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <StartPayoutButton shop={shop} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-base font-medium">Transfers</h2>

        {result.data.length === 0 ? (
          <p className="rounded-xl bg-card px-6 py-12 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
            No payouts have been run yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Parcels</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead className="text-right">Settle</TableHead>
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
                    <TableCell>
                      {/* Only a run that is still in progress can be settled:
                          both PAID and FAILED are terminal on the server. */}
                      {payout.status === "PROCESSING" ? (
                        <SettlePayoutButtons
                          payoutId={payout._id}
                          payoutNumber={payout.payoutNumber}
                        />
                      ) : (
                        <span className="block text-right text-xs text-muted-foreground">
                          Settled
                        </span>
                      )}
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
