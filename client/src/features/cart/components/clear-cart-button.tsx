"use client";

import { Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "../hooks/use-cart";

export function ClearCartButton() {
  const { clear, isPending } = useCart();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => void clear()}
      disabled={isPending}
      className="text-muted-foreground"
    >
      <Trash2Icon data-icon="inline-start" aria-hidden />
      Empty cart
    </Button>
  );
}
