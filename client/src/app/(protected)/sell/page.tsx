import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/features/auth/server/guards";
import { routes } from "@/config/routes";
import { ShopForm } from "@/features/vendors/components/shop-form";
import { getMyVendor } from "@/features/vendors/server/vendors";

export const metadata: Metadata = {
  title: "Sell on My Shop",
  description: "Apply to open a shop on the marketplace.",
};

/**
 * The seller application.
 *
 * Outside the `/seller` group on purpose: everything there is behind
 * `requireMerchant`, and the whole point of this page is that the visitor is
 * not a merchant yet. It needs only a signed-in account.
 *
 * Someone who already has a shop is redirected to their dashboard rather than
 * shown a form the API would reject — one shop per account is enforced by a
 * unique index on the owner.
 */
export default async function SellPage() {
  await requireUser();

  const existing = await getMyVendor();
  if (existing) {
    redirect(routes.seller.root);
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <header className="mb-6 flex flex-col gap-1">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Sell on My Shop
        </h1>
        <p className="text-sm text-muted-foreground">
          Tell us about your business and where to send your money. An admin
          reviews every application before the shop goes live.
        </p>
      </header>

      <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <ShopForm />
      </div>
    </div>
  );
}
