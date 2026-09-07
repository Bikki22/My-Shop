"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { isApiError } from "@/lib/api";
import { useApi } from "@/lib/api/client";
import { cancelOrderRequest, cancelSubOrderRequest } from "../api/order.api";

/**
 * What is being cancelled: a whole order, or one shop's parcel.
 *
 * Both exist because both are real operations on the server, and they are
 * genuinely different: cancelling the order cancels every part that has not
 * shipped, while cancelling a sub-order leaves the other shops fulfilling.
 */
export type CancelTarget =
  | { kind: "order"; id: string }
  | { kind: "sub-order"; id: string };

interface Variables {
  target: CancelTarget;
  reason?: string;
}

/**
 * Cancellation, against `PATCH /orders/:id/cancel` and
 * `PATCH /orders/sub-orders/:id/cancel`.
 *
 * `useMutation` for the request state, but `router.refresh()` for the data —
 * and that is on purpose. The order pages are Server Components: they are
 * URL-driven reads that also resolve shop names server-side, so there is no
 * client cache entry to write into. Refreshing the route is the mechanism that
 * updates them.
 *
 * The response is discarded rather than merged in, because cancelling changes
 * more than the thing cancelled: the parent order's derived status, the
 * parcel's status, the payment state and (for a prepaid order) the refund line
 * all move together. Re-reading is the only way to be sure every one of those
 * is what the server now says rather than what this hook guessed.
 */
export function useCancelOrder() {
  const api = useApi();
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();

  const mutation = useMutation({
    mutationFn: async ({ target, reason }: Variables) => {
      const trimmed = reason?.trim();
      const { path, ...options } =
        target.kind === "order"
          ? cancelOrderRequest(target.id, trimmed || undefined)
          : cancelSubOrderRequest(target.id, trimmed || undefined);

      return api(path, options);
    },

    onSuccess: (_data, { target }) => {
      toast.success(
        target.kind === "order"
          ? "Order cancelled"
          : "That parcel was cancelled",
      );
      startTransition(() => {
        router.refresh();
      });
    },

    onError: (error) => {
      // "This order has already shipped" is the common one, and it is the
      // server's to phrase — the transition rules live there.
      if (isApiError(error)) {
        toast.error(error.message);
        return;
      }
      throw error;
    },
  });

  const cancel = async (
    target: CancelTarget,
    reason?: string,
  ): Promise<boolean> => {
    try {
      await mutation.mutateAsync({ target, reason });
      return true;
    } catch {
      // `onError` has already reported it; the caller only needs to know
      // whether to close the dialog.
      return false;
    }
  };

  return {
    cancel,
    isPending: mutation.isPending || isRefreshing,
  };
}
