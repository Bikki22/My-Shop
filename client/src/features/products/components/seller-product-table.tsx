import Link from "next/link";
import { PencilIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { routes } from "@/config/routes";
import { formatPrice } from "@/lib/format";
import { DeleteProductButton } from "./delete-product-button";
import { LOW_STOCK_THRESHOLD, type ProductListItem } from "../types";

/**
 * The merchant's listings.
 *
 * A table rather than the shopper-facing grid: this is a worklist, and what
 * matters here is scanning price and stock down a column, not the photos.
 *
 * Stock carries a badge rather than only a number, because "0" and "3" look
 * alike in a column and mean very different things — one is unbuyable and one
 * needs restocking. The wording, not the colour, is what says which.
 */
export function SellerProductTable({
  products,
}: {
  products: readonly ProductListItem[];
}) {
  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Listing</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead>Stock</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product._id}>
              <TableCell className="max-w-[22rem] whitespace-normal">
                <Link
                  href={routes.seller.product(product._id)}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {product.name}
                </Link>
                {product.brand ? (
                  <span className="block text-xs text-muted-foreground">
                    {product.brand}
                  </span>
                ) : null}
              </TableCell>

              <TableCell className="text-right tabular-nums">
                {formatPrice(product.price)}
              </TableCell>

              <TableCell>
                <StockBadge stock={product.stock} />
              </TableCell>

              <TableCell>
                <div className="flex items-center justify-end gap-1.5">
                  <Button
                    render={<Link href={routes.seller.product(product._id)} />}
                    variant="ghost"
                    size="sm"
                  >
                    <PencilIcon />
                    Edit
                  </Button>
                  <DeleteProductButton
                    productId={product._id}
                    productName={product.name}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function StockBadge({ stock }: { stock: number }) {
  if (stock <= 0) {
    return <Badge variant="destructive">Out of stock</Badge>;
  }
  if (stock <= LOW_STOCK_THRESHOLD) {
    return <Badge variant="outline">{stock} left</Badge>;
  }
  return (
    <span className="text-sm tabular-nums text-muted-foreground">{stock}</span>
  );
}
