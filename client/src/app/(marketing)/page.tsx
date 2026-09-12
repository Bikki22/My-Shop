import Link from "next/link";
import {
  ArrowRightIcon,
  BadgeCheckIcon,
  PackageCheckIcon,
  WalletIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { listCategories } from "@/features/categories/server/categories";
import { ProductGrid } from "@/features/products/components/product-grid";
import {
  DEFAULT_PRODUCT_FILTERS,
  productsHref,
} from "@/features/products/lib/product-filters";
import { listProducts } from "@/features/products/server/products";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";

/** Enough to fill two rows of four without a short last row at any width. */
const HOME_PRODUCT_COUNT = 8;

/** The strip runs six across on a wide screen; more would wrap to a stub row. */
const HOME_CATEGORY_COUNT = 6;

/**
 * The storefront's front door, following `design/home.html`: a woven hero,
 * the catalogue's own categories, the newest listings, and a closing pitch
 * to the people who would sell here.
 *
 * Both reads degrade to nothing rather than throwing, so an unreachable API
 * costs the page its middle sections and still renders a hero someone can
 * navigate out of. They run together — neither section needs the other.
 *
 * There are deliberately no headline figures ("1,200+ vendors", "4.8 stars")
 * of the kind the mockup carries. Every number on this page would have to be
 * counted from real data to be worth printing, and an invented one on a
 * marketplace's front door is a claim about a business, not decoration.
 */
export default async function HomePage() {
  const [categories, trending] = await Promise.all([
    listCategories(),
    listProducts({ ...DEFAULT_PRODUCT_FILTERS, limit: HOME_PRODUCT_COUNT }),
  ]);

  return (
    <>
      <section className="bg-weave border-b border-border">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-16 lg:grid-cols-2 lg:py-24">
          <div className="flex flex-col items-start">
            <p className="mb-3.5 text-xs font-semibold tracking-[0.1em] text-danger uppercase">
              A marketplace of independent shops
            </p>

            <h1 className="font-heading text-4xl leading-[1.08] font-semibold tracking-tight text-balance sm:text-5xl">
              Made by someone,{" "}
              <em className="text-brand italic">delivered</em> to your door.
            </h1>

            <p className="mt-4 max-w-md leading-relaxed text-muted-foreground">
              {siteConfig.description} Buy straight from the shop that made it —
              every order tracked per vendor, paid your way.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button render={<Link href={routes.products} />} size="lg">
                Start browsing
                <ArrowRightIcon data-icon="inline-end" aria-hidden />
              </Button>
              <Button
                render={<Link href={routes.sellerApply} />}
                variant="outline"
                size="lg"
              >
                Open your shop
              </Button>
            </div>

            <ul className="mt-10 grid gap-5 sm:grid-cols-3">
              {[
                {
                  icon: <BadgeCheckIcon aria-hidden />,
                  title: "Reviewed shops",
                  body: "Approved by hand before opening.",
                },
                {
                  icon: <PackageCheckIcon aria-hidden />,
                  title: "Tracked per vendor",
                  body: "Split orders, followed separately.",
                },
                {
                  icon: <WalletIcon aria-hidden />,
                  title: "Pay your way",
                  body: "Cash on Delivery, or eSewa.",
                },
              ].map((point) => (
                <li key={point.title} className="flex flex-col gap-1.5">
                  <span className="text-success [&_svg]:size-5">
                    {point.icon}
                  </span>
                  <span className="text-[0.8125rem] font-semibold">
                    {point.title}
                  </span>
                  <span className="text-[0.8125rem] leading-relaxed text-muted-foreground">
                    {point.body}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Decorative: the palette's three dyes as a stack of stall tiles.
              Deliberately not mock product cards — a hero full of invented
              listings is the first thing a real catalogue contradicts. */}
          <div
            aria-hidden
            className="relative hidden h-96 lg:block"
            role="presentation"
          >
            <div className="absolute top-2 left-6 h-44 w-56 rotate-[-4deg] rounded-2xl border border-border bg-brand-soft shadow-[0_18px_40px_-18px_color-mix(in_srgb,var(--ink)_25%,transparent)]" />
            <div className="absolute top-28 left-40 h-48 w-60 rotate-[3deg] rounded-2xl border border-border bg-success-soft shadow-[0_18px_40px_-18px_color-mix(in_srgb,var(--ink)_25%,transparent)]" />
            <div className="absolute top-56 left-4 h-40 w-52 rotate-[-2deg] rounded-2xl border border-border bg-danger-soft shadow-[0_18px_40px_-18px_color-mix(in_srgb,var(--ink)_25%,transparent)]" />
            <span className="absolute top-44 left-36 inline-flex size-16 items-center justify-center rounded-2xl bg-brand font-heading text-3xl font-bold text-brand-foreground shadow-lg">
              {siteConfig.name.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      </section>

      {categories.length > 0 ? (
        <section className="mx-auto w-full max-w-6xl px-4 py-14">
          <div className="mb-6 flex items-baseline justify-between gap-4">
            <h2 className="font-heading text-2xl font-semibold tracking-tight">
              Shop by category
            </h2>
            <Link
              href={routes.products}
              className="text-[0.8125rem] font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              All categories →
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
            {categories.slice(0, HOME_CATEGORY_COUNT).map((category) => (
              <Link
                key={category._id}
                href={productsHref({
                  ...DEFAULT_PRODUCT_FILTERS,
                  categoryId: category._id,
                })}
                className="group flex flex-col items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-5 text-center transition-all duration-150 outline-none hover:-translate-y-0.5 hover:border-brand focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span
                  aria-hidden
                  className="inline-flex size-10 items-center justify-center rounded-full bg-brand-soft font-heading text-base font-semibold text-brand-soft-foreground"
                >
                  {category.name.charAt(0).toUpperCase()}
                </span>
                <span className="text-[0.8125rem] font-semibold">
                  {category.name}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {trending.page.docs.length > 0 ? (
        <section className="mx-auto w-full max-w-6xl px-4 pb-14">
          <div className="mb-6 flex items-baseline justify-between gap-4">
            <h2 className="font-heading text-2xl font-semibold tracking-tight">
              New in the market
            </h2>
            <Link
              href={routes.products}
              className="text-[0.8125rem] font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              See all products →
            </Link>
          </div>

          <ProductGrid products={trending.page.docs} />
        </section>
      ) : null}

      <section className="mx-auto w-full max-w-6xl px-4 pb-16">
        <div className="bg-weave grid items-center gap-8 rounded-2xl bg-ink p-10 lg:grid-cols-2 lg:p-12">
          <div>
            <p className="mb-3 text-xs font-semibold tracking-[0.1em] text-brand uppercase">
              Sell on {siteConfig.name}
            </p>
            <h2 className="font-heading text-3xl leading-tight font-semibold text-ink-foreground">
              Your shop, your prices, your customers.
            </h2>
            <p className="mt-3.5 max-w-md leading-relaxed text-ink-muted">
              List your products, manage your own orders, and get paid out on a
              schedule you can see. Applications are reviewed by hand.
            </p>
            <Button
              render={<Link href={routes.sellerApply} />}
              size="lg"
              className="mt-7 bg-brand text-brand-foreground hover:bg-brand/85"
            >
              Apply to sell
              <ArrowRightIcon data-icon="inline-end" aria-hidden />
            </Button>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2 lg:justify-self-end">
            {[
              { title: "Your own console", body: "Products, orders, payouts." },
              { title: "Per-vendor orders", body: "You fulfil only your part." },
              { title: "Visible payouts", body: "See what is queued and when." },
              { title: "No listing fee", body: "Commission on what sells." },
            ].map((perk) => (
              <li
                key={perk.title}
                className="rounded-xl border border-white/10 bg-white/5 p-4"
              >
                <span className="text-[0.8125rem] font-semibold text-ink-foreground">
                  {perk.title}
                </span>
                <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-muted">
                  {perk.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
