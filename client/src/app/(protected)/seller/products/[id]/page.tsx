import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { ProductForm } from "@/features/products/components/product-form";
import { ProductImageManager } from "@/features/products/components/product-image-manager";
import { getSellerProduct } from "@/features/products/server/seller-products";
import { NoShopPanel } from "@/features/vendors/components/no-shop-panel";
import { getMyVendor } from "@/features/vendors/server/vendors";

export const metadata: Metadata = { title: "Edit listing" };

/**
 * Editing one listing.
 *
 * `GET /products/:id` is public, so the read alone would happily return
 * another shop's listing. Every *write* is authorised on the server against
 * the caller's own shop, so nothing could be changed — but a form pre-filled
 * with someone else's product whose Save button 403s is a confusing way to
 * find that out. The ownership check below turns it into a 404 instead.
 */
export default async function EditProductPage({
  params,
}: PageProps<"/seller/products/[id]">) {
  const { id } = await params;

  const [shop, product] = await Promise.all([
    getMyVendor(),
    getSellerProduct(id),
  ]);

  if (!shop) {
    return <NoShopPanel />;
  }

  if (!product || product.vendor?._id !== shop._id) {
    notFound();
  }

  return (
    <>
      <div>
        <Button
          render={<Link href={routes.seller.products} />}
          variant="ghost"
          size="sm"
        >
          <ArrowLeftIcon />
          All listings
        </Button>
      </div>

      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          {product.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Changes are live as soon as you save them.
        </p>
      </header>

      {/* Photos first: a new listing lands here straight after being created,
          and adding real photos is the next thing to do. */}
      <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <ProductImageManager productId={product._id} images={product.images} />
      </div>

      <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <ProductForm product={product} />
      </div>
    </>
  );
}
