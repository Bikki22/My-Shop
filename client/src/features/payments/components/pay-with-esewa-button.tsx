"use client";

import { WalletIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEsewa } from "../hooks/use-esewa";

/**
 * "Pay now" for an eSewa order that is still unpaid.
 *
 * Shown on the confirmation and detail pages, which is the recovery path
 * that matters: a shopper who closed the eSewa tab, lost the redirect or
 * simply chose to pay later has a placed order and no way to settle it
 * otherwise.
 */
export function PayWithEsewaButton({
  orderId,
  size = "lg",
  className,
}: {
  orderId: string;
  size?: "sm" | "lg";
  className?: string;
}) {
  const { pay, isPending } = useEsewa();

  return (
    <Button
      size={size}
      className={className}
      onClick={() => void pay(orderId)}
      disabled={isPending}
    >
      <WalletIcon data-icon="inline-start" aria-hidden />
      {isPending ? "Opening eSewa…" : "Pay with eSewa"}
    </Button>
  );
}
