"use client";

import { useState } from "react";
import { Trash2Icon } from "lucide-react";
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
import { useDeleteProduct } from "../hooks/use-product-mutations";

/**
 * Removing a listing, behind a confirmation.
 *
 * Confirmed rather than one-click because it is destructive from where the
 * merchant sits, even though the server only soft-deletes — the row survives
 * so past orders keep their snapshot, but the listing is gone from the shop
 * and there is no undo in the UI.
 */
export function DeleteProductButton({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const { remove, isPending } = useDeleteProduct();
  const [open, setOpen] = useState(false);

  const confirm = async () => {
    if (await remove(productId)) {
      setOpen(false);
    }
    // On failure the dialog stays open: the toast says why, and the merchant
    // is still where they were rather than on a page that looks unchanged.
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm">
            <Trash2Icon />
            <span className="sr-only">Remove {productName}</span>
          </Button>
        }
      />

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove this listing?</DialogTitle>
          <DialogDescription>
            “{productName}” will stop appearing in the marketplace. Orders that
            already include it keep their own copy of the name, photo and
            price, so your history is unaffected.
          </DialogDescription>
        </DialogHeader>

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
            {isPending ? "Removing…" : "Remove listing"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
