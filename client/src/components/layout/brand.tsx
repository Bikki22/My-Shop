import type { Route } from "next";
import Link from "next/link";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

/**
 * The marigold tile the whole system hangs off — it is the one place the
 * brand colour appears at full strength on the storefront, which is what
 * makes it read as a mark rather than as another button.
 *
 * The letter comes from `siteConfig.name`, so renaming the marketplace is
 * still the one-line edit it was.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand",
        "font-heading text-[1.0625rem] leading-none font-bold text-brand-foreground",
        className,
      )}
    >
      {siteConfig.name.charAt(0).toUpperCase()}
    </span>
  );
}

/**
 * Mark plus wordmark, linked home.
 *
 * `subtitle` is for the consoles, where the mockups qualify the name with
 * the area you are in ("Vendor Console", "Platform Admin") — it is the only
 * thing distinguishing two otherwise identical navy sidebars.
 */
export function BrandLock({
  subtitle,
  href = routes.home,
  className,
  inverted = false,
}: {
  subtitle?: string;
  href?: Route;
  className?: string;
  /** For the navy surfaces: footer, auth panel, console sidebars. */
  inverted?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-lg outline-none",
        "focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      <BrandMark />
      <span className="flex flex-col">
        <span
          className={cn(
            "font-heading text-[1.1875rem] leading-tight font-semibold tracking-tight",
            inverted && "text-ink-foreground",
          )}
        >
          {siteConfig.name}
        </span>
        {subtitle ? (
          <span
            className={cn(
              "text-[0.6875rem] leading-tight",
              inverted ? "text-ink-muted" : "text-muted-foreground",
            )}
          >
            {subtitle}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
