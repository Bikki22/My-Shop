import Link from "next/link";
import { StoreIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";

/**
 * What the seller area shows a user who holds a selling role but has no shop.
 *
 * That combination is real rather than defensive: an admin has merchant
 * privileges by inheritance without ever having applied, and a merchant whose
 * shop was deleted keeps the role. Both would otherwise see a dashboard of
 * zeros with no explanation of why.
 */
export function NoShopPanel() {
  return (
    <div className="flex flex-col items-start gap-4 rounded-xl bg-card px-6 py-10 ring-1 ring-foreground/10">
      <StoreIcon className="size-6 text-muted-foreground" />
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-lg font-medium">
          You do not have a shop yet
        </h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          Selling on the marketplace needs a shop: a name, a business address
          and an account for us to send your money to. An admin reviews the
          application before your listings go live.
        </p>
      </div>
      <Button render={<Link href={routes.sellerApply} />}>Apply to sell</Button>
    </div>
  );
}
