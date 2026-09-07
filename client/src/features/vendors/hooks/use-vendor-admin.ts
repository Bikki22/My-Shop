"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { isApiError } from "@/lib/api";
import { useApi } from "@/lib/api/client";
import {
  renameVendorRequest,
  reviewVendorRequest,
  updateCommissionRequest,
} from "../api/vendor.api";
import type { ReviewOutcome, Vendor } from "../types";

/**
 * The staff writes against one shop: reviewing it, renegotiating its rate,
 * renaming it.
 *
 * `router.refresh()` rather than a cache write, like everywhere else in the
 * admin area — approving a shop does more than change its status, it also
 * grants the owner the merchant role, so re-reading is the only way to be
 * sure the screen shows what the server now believes.
 */
function reportError(error: unknown): void {
  if (isApiError(error)) {
    // "A reason is required when rejecting or suspending a shop" and the
    // like — the rules live on the server and it phrases them.
    toast.error(error.message);
    return;
  }
  throw error;
}

export function useVendorAdmin(vendorId: string) {
  const api = useApi();
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();

  const refresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  const review = useMutation({
    mutationFn: ({
      status,
      reason,
    }: {
      status: ReviewOutcome;
      reason?: string;
    }) => {
      const { path, ...options } = reviewVendorRequest(
        vendorId,
        status,
        reason,
      );
      return api<Vendor>(path, options);
    },
    onSuccess: (_data, { status }) => {
      toast.success(
        status === "APPROVED"
          ? "Shop approved — the owner can now list products"
          : `Shop ${status.toLowerCase()}`,
      );
      refresh();
    },
    onError: reportError,
  });

  const setCommission = useMutation({
    mutationFn: (commissionRate: number | null) => {
      const { path, ...options } = updateCommissionRequest(
        vendorId,
        commissionRate,
      );
      return api<Vendor>(path, options);
    },
    onSuccess: (_data, rate) => {
      toast.success(
        rate === null
          ? "Rate reset to the platform default"
          : "Commission rate updated",
      );
      refresh();
    },
    onError: reportError,
  });

  const rename = useMutation({
    mutationFn: (name: string) => {
      const { path, ...options } = renameVendorRequest(vendorId, name);
      return api<Vendor>(path, options);
    },
    onSuccess: () => {
      // Worth saying out loud: the slug is derived from the name, so this
      // moves the storefront URL and breaks links pointing at the old one.
      toast.success("Shop renamed — its storefront URL has moved");
      refresh();
    },
    onError: reportError,
  });

  return {
    review: (status: ReviewOutcome, reason?: string) =>
      review.mutateAsync({ status, reason }).then(
        () => true,
        () => false,
      ),
    setCommission: (rate: number | null) =>
      setCommission.mutateAsync(rate).then(
        () => true,
        () => false,
      ),
    rename: (name: string) =>
      rename.mutateAsync(name).then(
        () => true,
        () => false,
      ),
    isPending:
      review.isPending ||
      setCommission.isPending ||
      rename.isPending ||
      isRefreshing,
  };
}
