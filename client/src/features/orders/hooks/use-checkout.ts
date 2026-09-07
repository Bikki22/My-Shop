"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { routes } from "@/config/routes";
import { cartCache } from "@/features/cart/cart-cache";
import { useEsewa } from "@/features/payments/hooks/use-esewa";
import { isApiError } from "@/lib/api";
import { useApi } from "@/lib/api/client";
import { createOrderRequest } from "../api/order.api";
import type { CreateOrderInput, OrderDetail } from "../types";

/**
 * Checkout, against `POST /orders`.
 *
 * The two things worth knowing about the flow:
 *
 * 1. The request carries an address, a payment method and a note — nothing
 *    else. The lines, the per-shop split and every money figure are read from
 *    the cart server-side, so what is charged cannot be argued with from here.
 * 2. Placing the order and paying for it are separate steps. The order is
 *    durable and holding its stock before eSewa is ever opened, so an
 *    abandoned payment leaves a recoverable unpaid order rather than an empty
 *    cart and nothing to show for it.
 *
 * Field-level errors from the server's Zod validation are surfaced as a
 * `field -> message` map, keyed exactly as the API reports them
 * (`shippingAddress.city`), so the form can render each next to its input.
 */
export function useCheckout() {
  const api = useApi();
  const queryClient = useQueryClient();
  const { pay } = useEsewa();

  const mutation = useMutation({
    mutationFn: async (input: CreateOrderInput) => {
      const { path, ...options } = createOrderRequest(input);
      return api<OrderDetail>(path, options);
    },

    onSuccess: async ({ order }, input) => {
      // Checkout empties the cart server-side. Writing that in immediately
      // means the header badge is already correct before the browser leaves
      // this page — and correct too if the eSewa hop below fails and the
      // shopper stays.
      queryClient.setQueryData(cartCache.detail(), undefined);
      await queryClient.invalidateQueries({ queryKey: cartCache.all });

      if (input.paymentMethod === "ESEWA") {
        // Hands the browser to eSewa. If that fails the order still exists,
        // so fall through to the confirmation page — which offers "Pay with
        // eSewa" again — rather than stranding the shopper.
        if (await pay(order._id)) return;
      }

      // A full navigation rather than `router.replace()`, for the same reason
      // `SignInForm.finalize` does it: this leaves a route whose Server
      // Component redirects an empty cart straight back to `/cart`, and a soft
      // navigation that re-rendered it would send the shopper there instead of
      // to their receipt.
      window.location.assign(routes.orderConfirmation(order._id));
    },

    onError: (error) => {
      if (isApiError(error)) {
        // A 409 is the interesting one — a product sold out between the cart
        // page and this button — and its message is the only place that says
        // which product.
        toast.error(error.message);
        return;
      }
      throw error;
    },
  });

  return {
    placeOrder: (input: CreateOrderInput) => {
      mutation.mutate(input);
    },
    isPlacing: mutation.isPending,
    error: isApiError(mutation.error) ? mutation.error.message : null,
    /** `field -> message`, keyed as the API reports it. */
    fieldErrors: isApiError(mutation.error)
      ? Object.fromEntries(
          mutation.error.details.map(({ field, message }) => [field, message]),
        )
      : {},
  };
}
