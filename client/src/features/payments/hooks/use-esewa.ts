"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { isApiError } from "@/lib/api";
import { useApi } from "@/lib/api/client";
import { initiateEsewaRequest } from "../api/payment.api";
import { submitEsewaForm } from "../lib/esewa";
import type { EsewaCheckoutForm } from "../types";

/**
 * Starts an eSewa payment for an already-placed order.
 *
 * Payment is deliberately a *separate step from checkout*: the order exists
 * and holds its stock before any money is discussed, so a failed or
 * abandoned payment leaves a recoverable unpaid order rather than losing the
 * basket. That is also why this is safe to offer again from the confirmation
 * page — `initiateEsewa` refuses an order that is already paid.
 */
export function useEsewa() {
  const api = useApi();
  const [isPending, setIsPending] = useState(false);

  const pay = useCallback(
    async (orderId: string): Promise<boolean> => {
      const { path, ...options } = initiateEsewaRequest(orderId);
      setIsPending(true);

      try {
        submitEsewaForm(await api<EsewaCheckoutForm>(path, options));
        // The browser is leaving for eSewa; `isPending` stays true so the
        // button cannot be pressed twice during the navigation.
        return true;
      } catch (caught) {
        if (isApiError(caught)) {
          toast.error(caught.message);
          setIsPending(false);
          return false;
        }
        setIsPending(false);
        throw caught;
      }
    },
    [api],
  );

  return { pay, isPending };
}
