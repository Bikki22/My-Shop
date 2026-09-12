import type { Metadata } from "next";
import {
  BanknoteIcon,
  LayoutDashboardIcon,
  ShapesIcon,
  ShoppingBagIcon,
  StoreIcon,
  UsersIcon,
} from "lucide-react";
import {
  DashboardNav,
  type DashboardLink,
} from "@/components/layout/dashboard-nav";
import { requireAdmin } from "@/features/auth/server/guards";
import { routes } from "@/config/routes";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin" },
};

/**
 * The platform area: the whole marketplace, for staff.
 *
 * `requireAdmin()` renders the 403 page for a signed-in user without an admin
 * role, so nothing below it needs its own check. Every API call these pages
 * make is guarded again on the server — this guard controls what renders, not
 * what is reachable.
 */
const LINKS: readonly DashboardLink[] = [
  {
    href: routes.admin.root,
    label: "Overview",
    icon: <LayoutDashboardIcon />,
    exact: true,
  },
  { href: routes.admin.vendors, label: "Shops", icon: <StoreIcon /> },
  { href: routes.admin.orders, label: "Orders", icon: <ShoppingBagIcon /> },
  { href: routes.admin.payouts, label: "Payouts", icon: <BanknoteIcon /> },
  { href: routes.admin.customers, label: "Customers", icon: <UsersIcon /> },
  { href: routes.admin.categories, label: "Categories", icon: <ShapesIcon /> },
];

export default async function AdminLayout({ children }: LayoutProps<"/">) {
  await requireAdmin();

  return (
    <div className="flex flex-1 flex-col lg:grid lg:grid-cols-[15.5rem_1fr]">
      <DashboardNav links={LINKS} label="Administration" subtitle="Platform" />

      {/* The ruled ground from the mockups — a console of figures reading as
          a book of accounts. */}
      <div className="min-w-0 bg-workbench bg-ledger">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 lg:px-8">
          {children}
        </div>
      </div>
    </div>
  );
}
