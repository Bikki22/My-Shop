import type { Metadata } from "next";
import { ShopForm } from "@/features/vendors/components/shop-form";
import { NoShopPanel } from "@/features/vendors/components/no-shop-panel";
import { getMyVendor } from "@/features/vendors/server/vendors";

export const metadata: Metadata = {
  title: "Shop settings",
  description: "Your shop's details and where its money is sent.",
};

export default async function SellerSettingsPage() {
  const shop = await getMyVendor();

  if (!shop) {
    return <NoShopPanel />;
  }

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Shop settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Changing where money is sent affects future payouts only — transfers
          already made keep a copy of the account they went to.
        </p>
      </header>

      <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <ShopForm shop={shop} />
      </div>
    </>
  );
}
