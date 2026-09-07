"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { isApiError } from "@/lib/api";
import { useApi } from "@/lib/api/client";
import { updateSubOrderStatusRequest } from "../api/order.api";
import type { OrderStatus } from "../types";

interface Variables {
  status: OrderStatus;
  note?: string;
  courier?: string;
  trackingNumber?: string;
}

/**
 * A shop moving one of its parcels along.
 *
 * `useMutation` for the request state, `router.refresh()` for the data — the
 * same split `useCancelOrder` documents, and for the same reason: the queue
 * and the parcel page are Server Components, so there is no client cache
 * entry to write into.
 *
 * The response is discarded rather than merged in, because a transition moves
 * more than the parcel: the parent order's derived status is recomputed from
 * every shop's part, and delivering a parcel is what makes its money payable.
 * Re-reading is the only way to be sure each of those is what the server now
 * says rather than what this hook guessed.
 */
export function useSubOrderStatus(subOrderId: string) {
  const api = useApi();
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();

  const mutation = useMutation({
    mutationFn: (variables: Variables) => {
      const { path, ...options } = updateSubOrderStatusRequest(subOrderId, {
        status: variables.status,
        // Empty strings are dropped rather than sent: the server's schema
        // rejects a courier on anything but SHIPPED, and an empty one would
        // still count as supplied.
        ...(variables.note?.trim() ? { note: variables.note.trim() } : {}),
        ...(variables.courier?.trim()
          ? { courier: variables.courier.trim() }
          : {}),
        ...(variables.trackingNumber?.trim()
          ? { trackingNumber: variables.trackingNumber.trim() }
          : {}),
      });
      return api(path, options);
    },

    onSuccess: (_data, { status }) => {
      toast.success(`Marked ${status.toLowerCase()}`);
      startTransition(() => {
        router.refresh();
      });
    },

    onError: (error) => {
      // "A delivered parcel cannot be marked processing" — the transition
      // rules live on the server and it phrases them.
      if (isApiError(error)) {
        toast.error(error.message);
        return;
      }
      throw error;
    },
  });

  return {
    update: async (variables: Variables): Promise<boolean> => {
      try {
        await mutation.mutateAsync(variables);
        return true;
      } catch {
        return false;
      }
    },
    isPending: mutation.isPending || isRefreshing,
  };
}
