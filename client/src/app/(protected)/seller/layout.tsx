import type { Metadata } from "next";
import {
  BanknoteIcon,
  LayoutDashboardIcon,
  PackageIcon,
  SettingsIcon,
  ShoppingBagIcon,
} from "lucide-react";
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
  {
    href: routes.seller.root,
    label: "Dashboard",
    icon: <LayoutDashboardIcon />,
    exact: true,
  },
  { href: routes.seller.products, label: "Products", icon: <PackageIcon /> },
  { href: routes.seller.orders, label: "Orders", icon: <ShoppingBagIcon /> },
  { href: routes.seller.payouts, label: "Payouts", icon: <BanknoteIcon /> },
  {
    href: routes.seller.settings,
    label: "Shop settings",
    icon: <SettingsIcon />,
  },
];

export default async function SellerLayout({ children }: LayoutProps<"/">) {
  await requireMerchant();

  return (
    <div className="flex flex-1 flex-col lg:grid lg:grid-cols-[15.5rem_1fr]">
      <DashboardNav links={LINKS} label="Shop" subtitle="Vendor console" />

      {/* The ruled ground from the mockups — a console of figures reading as
          a book of accounts. */}
      <div className="min-w-0 bg-workbench bg-ledger">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 lg:px-8">
          {children}
        </div>
      </div>
    </div>
  );
}
