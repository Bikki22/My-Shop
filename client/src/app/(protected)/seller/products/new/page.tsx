import type { Metadata } from "next";
import { ProductForm } from "@/features/products/components/product-form";
import { NoShopPanel } from "@/features/vendors/components/no-shop-panel";
import { getMyVendor } from "@/features/vendors/server/vendors";

export const metadata: Metadata = {
  title: "New listing",
  description: "Add a product to your shop.",
};

/**
 * Creating a listing.
 *
 * The shop is read here rather than trusted from the role: `requireMerchant`
 * in the layout says the user *may* sell, and this says they have somewhere
 * to sell from. The API would refuse anyway — this turns that 403 into an
 * explanation.
 */
export default async function NewProductPage() {
  const shop = await getMyVendor();

  if (!shop) {
    return <NoShopPanel />;
  }

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          New listing
        </h1>
        <p className="text-sm text-muted-foreground">
          It goes live on {shop.name} as soon as you publish it.
        </p>
      </header>

      <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <ProductForm />
      </div>
    </>
  );
}
