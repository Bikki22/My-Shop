"use client";

import { useState, type ReactElement } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCancelOrder, type CancelTarget } from "../hooks/use-cancel-order";

/**
 * Cancellation behind a confirmation, with an optional reason.
 *
 * Confirmed rather than one-click because it cannot be undone, and the
 * reason is optional because the server treats it as optional — a required
 * field here would block a cancellation the API would happily accept.
 */
export function CancelOrderDialog({
  target,
  title,
  description,
  trigger,
}: {
  target: CancelTarget;
  title: string;
  description: string;
  trigger: ReactElement;
}) {
  const { cancel, isPending } = useCancelOrder();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const confirm = async () => {
    if (await cancel(target, reason)) {
      setOpen(false);
      setReason("");
    }
    // On failure the dialog stays open: the toast says why, and the shopper
    // is still where they were rather than back on a page that looks unchanged.
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-1.5">
          <Label htmlFor="cancel-reason">Reason (optional)</Label>
          <Input
            id="cancel-reason"
            value={reason}
            maxLength={200}
            placeholder="e.g. Ordered the wrong size"
            onChange={(event) => setReason(event.target.value)}
            className="h-10"
          />
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" size="lg" />}>
            Keep it
          </DialogClose>
          <Button
            size="lg"
            variant="destructive"
            onClick={() => void confirm()}
            disabled={isPending}
          >
            {isPending ? "Cancelling…" : "Cancel order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
