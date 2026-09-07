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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSubOrderStatus } from "../hooks/use-sub-order-status";
import { SUB_ORDER_ACTIONS, type OrderStatus } from "../types";
import { ORDER_STATUS_LABELS } from "../lib/format";

/**
 * The buttons a shop moves a parcel with.
 *
 * Every transition is offered rather than only the "next" one, because the
 * server owns the rules and they are not a straight line — a shop can confirm
 * and pack in one step on a small order. An illegal move comes back as a 403
 * with the server's own wording, which is better than a client-side guess at
 * a state machine that lives somewhere else.
 *
 * Shipping is the one transition that opens a dialog: it is the only one that
 * accepts courier details, and the server rejects those on any other status.
 */
export function SubOrderStatusControl({
  subOrderId,
  current,
}: {
  subOrderId: string;
  current: OrderStatus;
}) {
  const { update, isPending } = useSubOrderStatus(subOrderId);
  const [shipOpen, setShipOpen] = useState(false);
  const [courier, setCourier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");

  // A finished parcel has nowhere left to go, and offering buttons that can
  // only fail is worse than offering none.
  if (current === "DELIVERED" || current === "CANCELLED") {
    return (
      <p className="text-sm text-muted-foreground">
        This parcel is {ORDER_STATUS_LABELS[current].toLowerCase()} — there is
        nothing left to update.
      </p>
    );
  }

  const ship = async () => {
    if (await update({ status: "SHIPPED", courier, trackingNumber })) {
      setShipOpen(false);
      setCourier("");
      setTrackingNumber("");
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {SUB_ORDER_ACTIONS.filter((action) => action.status !== current).map(
          (action) => (
            <Button
              key={action.status}
              size="sm"
              variant={action.status === "SHIPPED" ? "default" : "outline"}
              disabled={isPending}
              onClick={() => {
                if (action.status === "SHIPPED") {
                  setShipOpen(true);
                  return;
                }
                void update({ status: action.status });
              }}
            >
              {action.label}
            </Button>
          ),
        )}
      </div>

      <Dialog open={shipOpen} onOpenChange={setShipOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark this parcel shipped</DialogTitle>
            <DialogDescription>
              Courier details are optional, but they are what the customer sees
              on their tracking page.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="courier">Courier</Label>
              <Input
                id="courier"
                value={courier}
                maxLength={60}
                placeholder="e.g. Aramex"
                onChange={(event) => {
                  setCourier(event.target.value);
                }}
                className="h-10"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="tracking">Tracking number</Label>
              <Input
                id="tracking"
                value={trackingNumber}
                maxLength={60}
                onChange={(event) => {
                  setTrackingNumber(event.target.value);
                }}
                className="h-10"
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" size="lg" />}>
              Cancel
            </DialogClose>
            <Button size="lg" disabled={isPending} onClick={() => void ship()}>
              {isPending ? "Saving…" : "Mark shipped"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
