import Link from "next/link";
import { SearchIcon } from "lucide-react";
import { BrandLock } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/features/auth/components/user-menu";
import { CartLink } from "@/features/cart/components/cart-link";
import { PRODUCT_PARAM } from "@/features/products/lib/product-filters";
import { routes } from "@/config/routes";

/**
 * The storefront header from the mockups: an announcement strip over a
 * sticky bar carrying the mark, the sections, search, and the cart.
 *
 * The search box is a plain GET form pointed at the catalogue, which keeps
 * this a Server Component and makes search work before any JavaScript
 * arrives. It submits the same `search` key the catalogue already parses, so
 * a header search lands on a normal, shareable, filterable results URL —
 * there is no second search contract to keep in step.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40">
      {/* Both claims are things the marketplace actually does: eSewa is the
          integrated gateway, and shops are approved by staff before opening. */}
      <div className="bg-ink px-4 py-1.5 text-center text-[0.78125rem] text-ink-foreground">
        Cash on Delivery or eSewa · every shop reviewed before it opens
      </div>

      <div className="border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 sm:gap-6">
          <BrandLock />

          <nav className="hidden items-center gap-5 text-sm font-medium lg:flex">
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
            <Link
              href={routes.sellerApply}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Sell
            </Link>
          </nav>

          <form
            action={routes.products}
            method="get"
            role="search"
            className="ml-auto hidden max-w-md flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3.5 py-2 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30 sm:flex lg:ml-0"
          >
            <SearchIcon
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <input
              type="search"
              name={PRODUCT_PARAM.search}
              placeholder="Search products and shops…"
              aria-label="Search products and shops"
              className="w-full min-w-0 bg-transparent text-[0.84375rem] outline-none placeholder:text-muted-foreground"
            />
          </form>

          <div className="ml-auto flex items-center gap-2 sm:ml-0">
            {/* Reads the shared query cache, so it moves the moment any cart
                write resolves — no Suspense boundary needed, because it renders
                a bare icon until the count arrives rather than blocking. */}
            <CartLink />
            <UserMenu />
            <Button
              render={<Link href={routes.sellerApply} />}
              size="sm"
              className="hidden xl:inline-flex"
            >
              Become a vendor
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
