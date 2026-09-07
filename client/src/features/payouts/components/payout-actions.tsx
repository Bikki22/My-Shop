"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPrice, pluralize } from "@/lib/format";
import { usePayoutActions } from "../hooks/use-payout-actions";
import type { PayableVendor } from "../types";

/**
 * Starting a payout run for one shop.
 *
 * Confirmed rather than one-click because it moves money and cannot be
 * undone: the run claims every payable parcel the shop has, and reversing it
 * means marking the transfer failed, which is a separate record rather than
 * a delete.
 *
 * The amount shown is what the queue last read, and the dialog says so — the
 * run itself sums whatever it actually claims at the moment it claims it, so
 * a sale that lands in between is included and the figure here is a preview,
 * not a promise.
 */
export function StartPayoutButton({ shop }: { shop: PayableVendor }) {
  const { start, isPending } = usePayoutActions();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");

  const confirm = async () => {
    if (await start(shop.vendor, notes.trim() || undefined)) {
      setOpen(false);
      setNotes("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">Start payout</Button>} />

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pay {shop.name}?</DialogTitle>
          <DialogDescription>
            This claims {pluralize(shop.subOrderCount, "parcel")} worth about{" "}
            {formatPrice(shop.amount)} and records a transfer. The exact
            figure is summed from whatever is payable at the moment the run
            starts, so it may differ slightly from this preview.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-1.5">
          <Label htmlFor="payout-notes">Notes (optional)</Label>
          <Input
            id="payout-notes"
            value={notes}
            maxLength={500}
            placeholder="e.g. September settlement"
            onChange={(event) => {
              setNotes(event.target.value);
            }}
            className="h-10"
          />
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" size="lg" />}>
            Cancel
          </DialogClose>
          <Button size="lg" disabled={isPending} onClick={() => void confirm()}>
            {isPending ? "Starting…" : "Start payout"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Settling a run that is in progress.
 *
 * Both outcomes are terminal on the server: a failed transfer goes out again
 * as a *new* run against the parcels this one released, never as a retry in
 * place, so there would be no record that the first attempt happened.
 */
export function SettlePayoutButtons({
  payoutId,
  payoutNumber,
}: {
  payoutId: string;
  payoutNumber: string;
}) {
  const { markPaid, markFailed, isPending } = usePayoutActions();
  const [paidOpen, setPaidOpen] = useState(false);
  const [failedOpen, setFailedOpen] = useState(false);
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");

  return (
    <div className="flex justify-end gap-1.5">
      <Dialog open={paidOpen} onOpenChange={setPaidOpen}>
        <DialogTrigger
          render={
            <Button size="sm" variant="outline">
              Mark paid
            </Button>
          }
        />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record {payoutNumber} as paid</DialogTitle>
            <DialogDescription>
              The bank&rsquo;s or eSewa&rsquo;s own transaction reference. It
              is what a shop quotes if the money does not arrive, so it is
              required.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-1.5">
            <Label htmlFor="payout-reference">Transfer reference</Label>
            <Input
              id="payout-reference"
              value={reference}
              maxLength={100}
              required
              onChange={(event) => {
                setReference(event.target.value);
              }}
              className="h-10"
            />
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" size="lg" />}>
              Cancel
            </DialogClose>
            <Button
              size="lg"
              disabled={isPending || reference.trim().length === 0}
              onClick={() => {
                void markPaid(payoutId, reference.trim()).then((ok) => {
                  if (ok) {
                    setPaidOpen(false);
                    setReference("");
                  }
                });
              }}
            >
              {isPending ? "Saving…" : "Mark paid"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={failedOpen} onOpenChange={setFailedOpen}>
        <DialogTrigger
          render={
            <Button size="sm" variant="ghost">
              Mark failed
            </Button>
          }
        />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record {payoutNumber} as failed</DialogTitle>
            <DialogDescription>
              The parcels this run claimed go back to payable so the next run
              picks them up — except any cancelled since, which are reversed.
              The money goes out again as a new run, not as a retry of this
              one.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-1.5">
            <Label htmlFor="payout-reason">Reason</Label>
            <Input
              id="payout-reason"
              value={reason}
              maxLength={300}
              required
              placeholder="e.g. Account number rejected by the bank"
              onChange={(event) => {
                setReason(event.target.value);
              }}
              className="h-10"
            />
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" size="lg" />}>
              Cancel
            </DialogClose>
            <Button
              size="lg"
              variant="destructive"
              disabled={isPending || reason.trim().length === 0}
              onClick={() => {
                void markFailed(payoutId, reason.trim()).then((ok) => {
                  if (ok) {
                    setFailedOpen(false);
                    setReason("");
                  }
                });
              }}
            >
              {isPending ? "Saving…" : "Mark failed"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
