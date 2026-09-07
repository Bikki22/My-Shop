import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ExternalLinkIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { VendorReviewPanel } from "@/features/vendors/components/vendor-review-panel";
import { getVendorForAdmin } from "@/features/vendors/server/vendors";
import { VENDOR_STATUS_LABELS } from "@/features/vendors/types";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Shop" };

/**
 * One shop, as staff see it.
 *
 * This is the only screen in the app that renders a shop's private record —
 * the payout account it is paid into and the KYC documents it registered
 * with. The public projection (`VendorSummary`) deliberately withholds both,
 * which is why this page reads through `/vendors/admin/:id` rather than the
 * storefront endpoint.
 */
export default async function AdminVendorPage({
  params,
}: PageProps<"/admin/vendors/[id]">) {
  const { id } = await params;
  const shop = await getVendorForAdmin(id);

  if (!shop) {
    notFound();
  }

  return (
    <>
      <div>
        <Button
          render={<Link href={routes.admin.vendors} />}
          variant="ghost"
          size="sm"
        >
          <ArrowLeftIcon />
          All shops
        </Button>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            {shop.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Applied {formatDateTime(shop.createdAt)}
            {shop.reviewedAt
              ? ` · last reviewed ${formatDateTime(shop.reviewedAt)}`
              : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={shop.status === "APPROVED" ? "secondary" : "outline"}
          >
            {VENDOR_STATUS_LABELS[shop.status]}
          </Badge>
          {shop.status === "APPROVED" ? (
            <Button
              render={<Link href={routes.shop(shop.slug)} />}
              variant="ghost"
              size="sm"
            >
              Storefront
              <ExternalLinkIcon />
            </Button>
          ) : null}
        </div>
      </header>

      {shop.rejectionReason ?? shop.suspensionReason ? (
        <div className="rounded-xl bg-muted px-4 py-3 text-sm">
          <span className="font-semibold">Last decision:</span>{" "}
          <span className="text-muted-foreground">
            {shop.rejectionReason ?? shop.suspensionReason}
          </span>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
          <h2 className="font-heading text-base font-medium">Business</h2>
          <dl className="grid gap-2 text-sm">
            <Row label="Contact email">{shop.email}</Row>
            <Row label="Phone">{shop.phone}</Row>
            <Row label="Address">
              {[
                shop.address.line1,
                shop.address.line2,
                shop.address.city,
                shop.address.state,
                shop.address.postalCode,
                shop.address.country,
              ]
                .filter(Boolean)
                .join(", ")}
            </Row>
            <Row label="Storefront">/shops/{shop.slug}</Row>
            <Row label="Listings">{shop.productCount}</Row>
          </dl>
          {shop.description ? (
            <p className="text-sm text-muted-foreground">{shop.description}</p>
          ) : null}
        </section>

        <section className="flex flex-col gap-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
          <h2 className="font-heading text-base font-medium">
            Where money is sent
          </h2>
          <dl className="grid gap-2 text-sm">
            {shop.payoutAccount.method === "ESEWA" ? (
              <>
                <Row label="Method">eSewa</Row>
                <Row label="eSewa ID">{shop.payoutAccount.esewaId}</Row>
              </>
            ) : (
              <>
                <Row label="Method">Bank transfer</Row>
                <Row label="Bank">{shop.payoutAccount.bankName}</Row>
                <Row label="Account name">
                  {shop.payoutAccount.accountName}
                </Row>
                <Row label="Account number">
                  {shop.payoutAccount.accountNumber}
                </Row>
              </>
            )}
          </dl>

          <h3 className="mt-2 text-sm font-semibold">Documents</h3>
          {shop.documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              None uploaded. Approving without documents is a judgement call.
            </p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {shop.documents.map((document) => (
                <li key={document.url}>
                  <a
                    href={document.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
                  >
                    {document.label}
                    <ExternalLinkIcon className="size-3" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <VendorReviewPanel shop={shop} />
      </div>
    </>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
