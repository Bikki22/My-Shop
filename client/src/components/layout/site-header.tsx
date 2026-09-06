import Link from "next/link";
import { UserMenu } from "@/features/auth/components/user-menu";
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
          </nav>
        </div>
        <UserMenu />
      </div>
    </header>
  );
}
