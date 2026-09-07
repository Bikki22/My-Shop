import Link from "next/link";
import { UserMenu } from "@/features/auth/components/user-menu";
import { CartLink } from "@/features/cart/components/cart-link";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-6">
          <Link href={routes.home} className="font-semibold tracking-tight">
            {siteConfig.name}
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href={routes.products}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Products
            </Link>
            <Link
              href={routes.orders}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Orders
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {/* Reads the shared query cache, so it moves the moment any cart
              write resolves — no Suspense boundary needed, because it renders
              a bare icon until the count arrives rather than blocking. */}
          <CartLink />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
