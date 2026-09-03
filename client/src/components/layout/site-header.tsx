import Link from "next/link";
import { UserMenu } from "@/features/auth/components/user-menu";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4">
        <Link href={routes.home} className="font-semibold tracking-tight">
          {siteConfig.name}
        </Link>
        <UserMenu />
      </div>
    </header>
  );
}
