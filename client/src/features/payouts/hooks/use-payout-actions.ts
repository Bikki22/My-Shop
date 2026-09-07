"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { isApiError } from "@/lib/api";
import { useApi } from "@/lib/api/client";
import {
  createPayoutRequest,
  markPayoutFailedRequest,
  markPayoutPaidRequest,
} from "../api/payout.api";
import type { Payout } from "../types";

/**
 * The three writes on the platform's payout screen.
 *
 * All three are `router.refresh()` rather than a cache write, and here that
 * is not just convention — each one moves money across *two* collections. A
 * run claims every payable parcel for a shop; marking it paid stamps them
 * paid; marking it failed releases them back to payable, except any cancelled
 * in the meantime, which are reversed instead. Guessing any of that in the
 * browser would show a balance that does not match the ledger.
 */
function useRefreshAfterWrite() {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();

  return {
    refresh: () => {
      startTransition(() => {
        router.refresh();
      });
    },
    isRefreshing,
  };
}

function reportError(error: unknown): void {
  if (isApiError(error)) {
    // "This shop has nothing payable right now — a payout may already be in
    // progress" is the common one, and it is the server's to phrase: it is
    // the only thing that knows what the claim actually caught.
    toast.error(error.message);
    return;
  }
  throw error;
}

export function usePayoutActions() {
  const api = useApi();
  const { refresh, isRefreshing } = useRefreshAfterWrite();

  const start = useMutation({
    mutationFn: ({ vendor, notes }: { vendor: string; notes?: string }) => {
      const { path, ...options } = createPayoutRequest(vendor, notes);
      return api<Payout>(path, options);
    },
    onSuccess: (payout) => {
      toast.success(
        `Started ${payout.payoutNumber} — ${String(payout.subOrderCount)} parcels claimed`,
      );
      refresh();
    },
    onError: reportError,
  });

  const markPaid = useMutation({
    mutationFn: ({
      id,
      reference,
      notes,
    }: {
      id: string;
      reference: string;
      notes?: string;
    }) => {
      const { path, ...options } = markPayoutPaidRequest(id, reference, notes);
      return api<Payout>(path, options);
    },
    onSuccess: () => {
      toast.success("Payout marked paid");
      refresh();
    },
    onError: reportError,
  });

  const markFailed = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => {
      const { path, ...options } = markPayoutFailedRequest(id, reason);
      return api<Payout>(path, options);
    },
    onSuccess: () => {
      toast.success("Payout marked failed — its parcels are payable again");
      refresh();
    },
    onError: reportError,
  });

  return {
    start: (vendor: string, notes?: string) =>
      start.mutateAsync({ vendor, notes }).then(
        () => true,
        () => false,
      ),
    markPaid: (id: string, reference: string, notes?: string) =>
      markPaid.mutateAsync({ id, reference, notes }).then(
        () => true,
        () => false,
      ),
    markFailed: (id: string, reason: string) =>
      markFailed.mutateAsync({ id, reason }).then(
        () => true,
        () => false,
      ),
    isPending:
      start.isPending ||
      markPaid.isPending ||
      markFailed.isPending ||
      isRefreshing,
  };
}
