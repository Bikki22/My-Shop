import type { Metadata } from "next";
import {
  DashboardNav,
  type DashboardLink,
} from "@/components/layout/dashboard-nav";
import { requireMerchant } from "@/features/auth/server/guards";
import { routes } from "@/config/routes";

export const metadata: Metadata = {
  title: { default: "My shop", template: "%s · My shop" },
};

/**
 * The merchant area: one shop, run by its owner.
 *
 * `requireMerchant()` renders the 403 page for a signed-in user without a
 * selling role, so nothing below it needs its own role check. It is not the
 * whole story though — the role says a user *may* sell, while the shop record
 * is what they sell *as*, and the API resolves that from the session on every
 * request. A merchant whose shop was deleted still passes this guard and gets
 * a 403 from the API, which the pages surface as a panel.
 *
 * `MERCHANT_ROLES` includes the admin roles, so staff can open a merchant's
 * screens — but only against their own shop, if they have one. There is no id
 * in any of these URLs to point somewhere else.
 */
const LINKS: readonly DashboardLink[] = [
  { href: routes.seller.root, label: "Dashboard", exact: true },
  { href: routes.seller.products, label: "Products" },
  { href: routes.seller.orders, label: "Orders" },
  { href: routes.seller.payouts, label: "Payouts" },
  { href: routes.seller.settings, label: "Shop settings" },
];

export default async function SellerLayout({ children }: LayoutProps<"/">) {
  await requireMerchant();

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        <DashboardNav
          links={LINKS}
          label="Shop"
          className="lg:w-48 lg:shrink-0"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-6">{children}</div>
      </div>
    </div>
  );
}
