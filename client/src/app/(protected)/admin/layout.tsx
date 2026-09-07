import type { Metadata } from "next";
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
  { href: routes.admin.root, label: "Overview", exact: true },
  { href: routes.admin.vendors, label: "Shops" },
  { href: routes.admin.orders, label: "Orders" },
  { href: routes.admin.payouts, label: "Payouts" },
  { href: routes.admin.customers, label: "Customers" },
  { href: routes.admin.categories, label: "Categories" },
];

export default async function AdminLayout({ children }: LayoutProps<"/">) {
  await requireAdmin();

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        <DashboardNav
          links={LINKS}
          label="Administration"
          className="lg:w-48 lg:shrink-0"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-6">{children}</div>
      </div>
    </div>
  );
}
