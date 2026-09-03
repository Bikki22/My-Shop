import { SiteHeader } from "@/components/layout/site-header";
import { requireUser } from "@/features/auth/server/guards";

/**
 * Everything under this group needs a signed-in user with a provisioned
 * account record.
 *
 * The proxy redirects guests before they get here, but this guard is what
 * actually enforces it — a layout can render for a request the proxy's
 * matcher never saw, and it also catches accounts the API has suspended.
 */
export default async function ProtectedLayout({
  children,
}: LayoutProps<"/">) {
  await requireUser();

  return (
    <>
      <SiteHeader />
      <main className="flex-1">{children}</main>
    </>
  );
}
