import type { Metadata } from "next";
import Link from "next/link";
import { TriangleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { listVendorsForAdmin } from "@/features/vendors/server/vendors";
import {
  VENDOR_STATUS_LABELS,
  VENDOR_STATUSES,
  type VendorStatus,
} from "@/features/vendors/types";
import { formatDate, formatRate, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Shops",
  description: "Applications to review, and every shop on the marketplace.",
};

const PAGE_SIZE = 20;

/**
 * The shop queue.
 *
 * Defaults to *all* statuses rather than to pending, because this is the only
 * screen that lists shops at all — filtering to the approval queue by default
 * would hide every approved shop behind a filter chip.
 */
export default async function AdminVendorsPage({
  searchParams,
}: PageProps<"/admin/vendors">) {
  const params = await searchParams;

  const rawStatus = params["status"];
  const statusParam = Array.isArray(rawStatus) ? rawStatus[0] : rawStatus;
  const status =
    VENDOR_STATUSES.find((value) => value === statusParam) ?? null;

  const rawSearch = params["q"];
  const search = (Array.isArray(rawSearch) ? rawSearch[0] : rawSearch) ?? "";
  const rawPage = params["page"];
  const page = Number(Array.isArray(rawPage) ? rawPage[0] : rawPage) || 1;

  const { page: result, error } = await listVendorsForAdmin({
    status,
    search,
    page,
    limit: PAGE_SIZE,
  });

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Shops
        </h1>
        <p className="text-sm text-muted-foreground">
          {error
            ? "The shop list is unavailable right now."
            : `${pluralize(result.pagination.total, "shop")}${status ? ` ${VENDOR_STATUS_LABELS[status].toLowerCase()}` : ""}.`}
        </p>
      </header>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <nav aria-label="Filter shops" className="flex flex-wrap gap-2">
          {[null, ...VENDOR_STATUSES].map((value) => {
            const current = value === status;
            return (
              <Link
                key={value ?? "all"}
                href={
                  value
                    ? `${routes.admin.vendors}?status=${value}`
                    : routes.admin.vendors
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
                {value ? VENDOR_STATUS_LABELS[value] : "All"}
              </Link>
            );
          })}
        </nav>

        <form action={routes.admin.vendors} className="flex max-w-xs gap-2">
          <Input
            name="q"
            type="search"
            defaultValue={search}
            placeholder="Search shops"
            aria-label="Search shops"
          />
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
      </div>

      {error ? (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>Could not load shops</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : result.data.length === 0 ? (
        <p className="rounded-xl bg-card px-6 py-12 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
          No shops match this view.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shop</TableHead>
                <TableHead>Applied</TableHead>
                <TableHead>Listings</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.map((shop) => (
                <TableRow key={shop._id}>
                  <TableCell>
                    <Link
                      href={routes.admin.vendor(shop._id)}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {shop.name}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {shop.email}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(shop.createdAt)}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {shop.productCount}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {shop.commissionRate === null
                      ? "Default"
                      : formatRate(shop.commissionRate)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={shop.status} />
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

function StatusBadge({ status }: { status: VendorStatus }) {
  const variant =
    status === "APPROVED"
      ? "secondary"
      : status === "SUSPENDED" || status === "REJECTED"
        ? "destructive"
        : "outline";

  return <Badge variant={variant}>{VENDOR_STATUS_LABELS[status]}</Badge>;
}
