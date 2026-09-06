/**
 * Mirrors `IProduct` from the server's `modules/products/product.model.ts`
 * as it arrives over the wire: `ObjectId`s are serialized to strings and
 * every `Date` to an ISO string.
 */

/** Fields every product response carries, however it was fetched. */
interface ProductBase {
  _id: string;
  name: string;
  description: string;
  brand: string;
  images: string[];
  price: number;
  stock: number;
  tags: string[];
  isFeatured: boolean;
  /** How many ratings the listing has. The server stores no average yet. */
  ratingCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * A row from a list endpoint.
 *
 * List reads go through an aggregation pipeline, which does not populate —
 * so the three references are still raw ids here. `GET /products/:id`
 * populates them; see `Product` below.
 */
export interface ProductListItem extends ProductBase {
  categoryId: string;
  vendor: string;
  owner: string;
}

export interface ProductCategoryRef {
  _id: string;
  name: string;
  slug: string;
}

/** Only the storefront-safe vendor fields the server chooses to populate. */
export interface ProductVendorRef {
  _id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  ratingAverage: number;
  ratingCount: number;
}

export interface ProductOwnerRef {
  _id: string;
  firstName: string;
  lastName?: string;
  avatarUrl?: string | null;
}

/**
 * A single product from `GET /products/:id`, with its category, shop and
 * owner populated. Each is nullable because a reference can outlive the
 * document it points at.
 */
export interface Product extends ProductBase {
  categoryId: ProductCategoryRef | null;
  vendor: ProductVendorRef | null;
  owner: ProductOwnerRef | null;
}

/** Matches the `sort` enum in the server's `getAllProductsQuerySchema`. */
export const PRODUCT_SORTS = ["newest", "price_asc", "price_desc"] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export const PRODUCT_SORT_LABELS: Record<ProductSort, string> = {
  newest: "Newest",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
};

/**
 * The catalogue query, in the shape the UI thinks about it. It maps 1:1
 * onto the server's accepted query params — see `lib/product-filters.ts`.
 */
export interface ProductFilters {
  search: string;
  categoryId: string | null;
  vendor: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  tags: string[];
  sort: ProductSort;
  page: number;
  limit: number;
}
