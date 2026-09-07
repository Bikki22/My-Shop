"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatRate } from "@/lib/format";
import { useVendorAdmin } from "../hooks/use-vendor-admin";
import type { ReviewOutcome, Vendor } from "../types";

/**
 * The decisions staff make about one shop.
 *
 * Approval is one click; rejecting and suspending require a reason, because
 * the server requires one — and rightly, since both are told to the shop
 * owner and "no" without a reason is not an answer they can act on.
 *
 * Renaming is here rather than on the shop's own settings screen for a
 * structural reason: the storefront slug is derived from the name, so a
 * rename moves the shop's URL and breaks every link pointing at it. That is
 * not a decision a shop should be able to make about itself mid-trade.
 */
export function VendorReviewPanel({ shop }: { shop: Vendor }) {
  const { review, setCommission, rename, isPending } = useVendorAdmin(shop._id);

  const [reason, setReason] = useState("");
  const [rate, setRate] = useState(
    shop.commissionRate === null ? "" : String(shop.commissionRate * 100),
  );
  const [name, setName] = useState(shop.name);

  const decide = async (status: ReviewOutcome) => {
    if (await review(status, reason.trim() || undefined)) {
      setReason("");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-base font-medium">Review</h2>

        <div className="grid gap-1.5">
          <Label htmlFor="review-reason">
            Reason (required to reject or suspend)
          </Label>
          <Input
            id="review-reason"
            value={reason}
            maxLength={300}
            placeholder="e.g. Registration document is unreadable"
            onChange={(event) => {
              setReason(event.target.value);
            }}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {shop.status !== "APPROVED" ? (
            <Button
              size="sm"
              disabled={isPending}
              onClick={() => void decide("APPROVED")}
            >
              Approve
            </Button>
          ) : null}
          {shop.status !== "REJECTED" ? (
            <Button
              size="sm"
              variant="outline"
              disabled={isPending || reason.trim().length === 0}
              onClick={() => void decide("REJECTED")}
            >
              Reject
            </Button>
          ) : null}
          {shop.status !== "SUSPENDED" ? (
            <Button
              size="sm"
              variant="destructive"
              disabled={isPending || reason.trim().length === 0}
              onClick={() => void decide("SUSPENDED")}
            >
              Suspend
            </Button>
          ) : null}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-base font-medium">Commission</h2>
        <p className="text-sm text-muted-foreground">
          Currently{" "}
          {shop.commissionRate === null
            ? "the platform default"
            : formatRate(shop.commissionRate)}
          . Clearing the field hands the shop back to the default rather than
          setting it to zero.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1.5">
            <Label htmlFor="commission-rate">Rate (%)</Label>
            <Input
              id="commission-rate"
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={rate}
              placeholder="Default"
              onChange={(event) => {
                setRate(event.target.value);
              }}
              className="w-32"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => {
              const trimmed = rate.trim();
              void setCommission(trimmed === "" ? null : Number(trimmed) / 100);
            }}
          >
            Save rate
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Changing this affects future sales only — every parcel stores the
          rate that applied when it was sold.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-base font-medium">Rename</h2>
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1.5">
            <Label htmlFor="shop-name">Shop name</Label>
            <Input
              id="shop-name"
              value={name}
              minLength={2}
              maxLength={60}
              onChange={(event) => {
                setName(event.target.value);
              }}
              className="w-64"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={isPending || name.trim() === shop.name}
            onClick={() => void rename(name.trim())}
          >
            Rename
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          The storefront URL is built from the name, so renaming moves it and
          breaks existing links. Currently <code>/shops/{shop.slug}</code>.
        </p>
      </section>
    </div>
  );
}
