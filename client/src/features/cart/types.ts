/**
 * Mirrors `CartView` from the server's `modules/cart/cart.service.ts` as it
 * arrives over the wire: `ObjectId`s are serialized to strings and every
 * `Date` to an ISO string.
 *
 * Note what a cart line does *not* carry: the server stores only the
 * product id and a quantity, and joins the name, image, price and stock
 * live on every read. So everything below except `quantity`/`addedAt` is
 * the product as it is *right now*, which is why a line can come back
 * unavailable or short on stock long after it was added.
 */

/** Single source of truth for the per-line cap — matches `MAX_ITEM_QUANTITY`. */
export const MAX_ITEM_QUANTITY = 99;

export interface CartItem {
  productId: string;
  /** Null once the product has been deleted; the line stays, worth 0. */
  name: string | null;
  brand: string | null;
  image: string | null;
  categoryId: string | null;
  /** Which shop sells this line — checkout splits the cart by it. */
  vendorId: string | null;
  vendorName: string | null;
  vendorSlug: string | null;
  /** False once the shop is no longer approved to sell. */
  vendorActive: boolean;
  price: number;
  stock: number;
  quantity: number;
  addedAt: string;
  /** False once the product is deleted. */
  isAvailable: boolean;
  /** False when the requested quantity now exceeds stock. */
  inStock: boolean;
  lineTotal: number;
}

/**
 * The lines from one shop, priced as they will be charged.
 *
 * A marketplace cart is really N carts wearing a trenchcoat: each shop
 * ships its own parcel and is charged its own delivery fee, so the totals
 * the customer sees are grouped the same way the order will be.
 */
export interface CartGroup {
  vendorId: string | null;
  vendorName: string | null;
  vendorSlug: string | null;
  vendorActive: boolean;
  items: CartItem[];
  subtotal: number;
  shippingFee: number;
  total: number;
}

export interface CartSummary {
  itemCount: number;
  totalQuantity: number;
  subtotal: number;
  /** Sum of every shop's delivery fee — one parcel per shop. */
  shippingFee: number;
  grandTotal: number;
  vendorCount: number;
  unavailableCount: number;
  inactiveShopCount: number;
  /** True when a line is deleted, short on stock, or from a closed shop. */
  hasIssues: boolean;
}

export interface Cart {
  /** Null for a shopper who has never added anything. */
  _id: string | null;
  user: string;
  items: CartItem[];
  groups: CartGroup[];
  summary: CartSummary;
}

/** The header badge needs counts, not the whole joined cart. */
export interface CartCounts {
  itemCount: number;
  totalQuantity: number;
}

/** What is wrong with one line, if anything — see `cartItemIssue`. */
export type CartItemIssue = "unavailable" | "shop-closed" | "out-of-stock";

/**
 * The single blocking problem with a line, most severe first.
 *
 * Ordered rather than reported as a list because a deleted product is also
 * technically "from no shop" and "out of stock": telling the shopper to fix
 * three problems that are one is how a cart becomes unfixable.
 */
export const cartItemIssue = (item: CartItem): CartItemIssue | null => {
  if (!item.isAvailable) return "unavailable";
  if (!item.vendorActive) return "shop-closed";
  if (!item.inStock) return "out-of-stock";
  return null;
};

export const CART_ISSUE_MESSAGES: Record<CartItemIssue, string> = {
  unavailable: "No longer available — remove it to continue",
  "shop-closed": "This shop is not selling right now",
  "out-of-stock": "Not enough stock left for this quantity",
};

/** An empty cart, for the fallback when the read fails. */
export const emptyCart = (): Cart => ({
  _id: null,
  user: "",
  items: [],
  groups: [],
  summary: {
    itemCount: 0,
    totalQuantity: 0,
    subtotal: 0,
    shippingFee: 0,
    grandTotal: 0,
    vendorCount: 0,
    unavailableCount: 0,
    inactiveShopCount: 0,
    hasIssues: false,
  },
});
