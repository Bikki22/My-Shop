"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isApiError, type RequestOptions } from "@/lib/api";
import { useApi } from "@/lib/api/client";
import {
  addCartItemRequest,
  clearCartRequest,
  removeCartItemRequest,
  setCartItemQuantityRequest,
} from "../api/cart.api";
import { cartCache, seedCart } from "../cart-cache";
import { emptyCart, type Cart } from "../types";

/**
 * What a write is doing, so a row can disable only its own controls.
 * `"cart"` is a whole-cart operation (emptying it).
 */
type Variables =
  | { kind: "add"; productId: string; quantity: number }
  | { kind: "quantity"; productId: string; quantity: number }
  | { kind: "remove"; productId: string }
  | { kind: "clear" };

const requestFor = (
  variables: Variables,
): { path: string } & RequestOptions => {
  switch (variables.kind) {
    case "add":
      return addCartItemRequest(variables.productId, variables.quantity);
    case "quantity":
      return setCartItemQuantityRequest(
        variables.productId,
        variables.quantity,
      );
    case "remove":
      return removeCartItemRequest(variables.productId);
    case "clear":
      return clearCartRequest();
  }
};

const successMessage = (variables: Variables): string | null => {
  switch (variables.kind) {
    case "add":
      return "Added to cart";
    case "remove":
      return "Removed from cart";
    case "clear":
      return "Cart emptied";
    // A stepper that toasts on every tap is noise — the number changing is
    // the feedback.
    case "quantity":
      return null;
  }
};

/**
 * Which line this write touches, for the per-row pending state.
 * `null` means the whole cart.
 */
const targetOf = (variables: Variables): string | null =>
  variables.kind === "clear" ? null : variables.productId;

/**
 * Applies the *structural* part of a write immediately, so the stepper and
 * the Remove button respond on the same frame as the tap.
 *
 * Deliberately partial: quantities, line totals and the item counts are
 * arithmetic this can do correctly, but the money is not. Delivery is charged
 * per shop and waived above a threshold, so a quantity change can flip a
 * shipping fee — guessing `grandTotal` here would show a total the shopper is
 * not going to be charged. Those figures are left as they were and marked
 * busy until the server's own recalculated cart lands in `onSuccess`.
 */
function optimistic(cart: Cart, variables: Variables): Cart {
  if (variables.kind === "clear") {
    return { ...emptyCart(), _id: cart._id, user: cart.user };
  }

  // Adding a product the cart has never held has no line to patch, and
  // inventing one would need the price and image the server holds. The row
  // arrives with the response instead.
  if (
    variables.kind === "add" &&
    !cart.items.some((item) => item.productId === variables.productId)
  ) {
    return cart;
  }

  const items = cart.items.flatMap((item) => {
    if (item.productId !== variables.productId) return [item];
    if (variables.kind === "remove") return [];

    const quantity =
      variables.kind === "add"
        ? item.quantity + variables.quantity
        : variables.quantity;

    return [
      {
        ...item,
        quantity,
        lineTotal: Math.round(item.price * quantity * 100) / 100,
        inStock: quantity <= item.stock,
      },
    ];
  });

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    ...cart,
    items,
    groups: cart.groups.map((group) => ({
      ...group,
      items: group.items
        .filter(
          (item) =>
            variables.kind !== "remove" ||
            item.productId !== variables.productId,
        )
        .map((item) =>
          item.productId === variables.productId
            ? (items.find((next) => next.productId === item.productId) ?? item)
            : item,
        ),
    })),
    summary: {
      ...cart.summary,
      itemCount: items.length,
      totalQuantity,
    },
  };
}

/**
 * Cart writes, against `/api/v1/cart`.
 *
 * The arrangement that makes this cheap: every cart mutation on the server
 * answers with the **whole recalculated cart**, so the response is written
 * straight into the cache. No refetch, no full-route re-render — one request
 * per write, and the header badge, the cart page and the checkout summary all
 * update from it because they read the same cache entry.
 *
 * `onMutate` patches what is safe to predict (see `optimistic`) so the
 * controls feel instant; `onSuccess` replaces the lot with the server's
 * arithmetic; `onError` puts the snapshot back and reports what the server
 * said. Money is never guessed.
 */
export function useCart() {
  const api = useApi();
  const queryClient = useQueryClient();
  const detailKey = cartCache.detail();

  const mutation = useMutation({
    mutationFn: async (variables: Variables) => {
      const { path, ...options } = requestFor(variables);
      return api<Cart>(path, options);
    },

    onMutate: async (variables) => {
      // Stop an in-flight read from landing after this write and undoing it.
      await queryClient.cancelQueries({ queryKey: detailKey });

      const previous = queryClient.getQueryData<Cart>(detailKey);
      if (previous) {
        seedCart(queryClient, optimistic(previous, variables));
      }
      return { previous };
    },

    onSuccess: (cart, variables) => {
      seedCart(queryClient, cart);

      const message = successMessage(variables);
      if (message) toast.success(message);
    },

    onError: (error, _variables, context) => {
      if (context?.previous) {
        seedCart(queryClient, context.previous);
      }

      // Everything the cart refuses is something the shopper can act on —
      // "only 2 left", "that shop has closed", "sign in first" — so the
      // server's own message is shown rather than a generic failure.
      if (isApiError(error)) {
        toast.error(error.message);
        return;
      }
      throw error;
    },

    onSettled: () => {
      // A write that raced another (two tabs, a double tap) can leave the
      // cache holding the loser's answer. One background read settles it.
      void queryClient.invalidateQueries({ queryKey: detailKey });
    },
  });

  /**
   * `mutateAsync` with the rejection swallowed: `onError` has already
   * reported it, and callers want "did it land?" rather than a throw to
   * handle — `AddToCart` uses the answer to decide whether to go to checkout.
   */
  const run = async (variables: Variables): Promise<boolean> => {
    try {
      await mutation.mutateAsync(variables);
      return true;
    } catch {
      return false;
    }
  };

  const pendingFor = mutation.isPending
    ? targetOf(mutation.variables)
    : undefined;

  return {
    addItem: (productId: string, quantity = 1) =>
      run({ kind: "add", productId, quantity }),
    setQuantity: (productId: string, quantity: number) =>
      run({ kind: "quantity", productId, quantity }),
    removeItem: (productId: string) => run({ kind: "remove", productId }),
    clear: () => run({ kind: "clear" }),

    /** True while any write is in flight. */
    isPending: mutation.isPending,
    /** True while *this* line is being written. */
    isPendingFor: (productId: string) => pendingFor === productId,
  };
}
