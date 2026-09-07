"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_ITEM_QUANTITY } from "../types";

/**
 * The design's `.qty-stepper`: two buttons either side of a monospaced
 * count.
 *
 * A stepper rather than a number input on purpose — the server caps a line
 * at `MAX_ITEM_QUANTITY` and at the product's stock, and a free-text field
 * invites typing `500` only to be told no. Here the `+` simply stops.
 */
export function QuantityStepper({
  value,
  onChange,
  max = MAX_ITEM_QUANTITY,
  disabled = false,
  size = "sm",
  label = "Quantity",
}: {
  value: number;
  onChange: (quantity: number) => void;
  /** Usually the product's stock. Clamped to the per-line cap regardless. */
  max?: number;
  disabled?: boolean;
  size?: "sm" | "lg";
  label?: string;
}) {
  const ceiling = Math.min(max, MAX_ITEM_QUANTITY);
  const button = cn(
    "inline-flex items-center justify-center text-muted-foreground transition-colors",
    "hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40",
    "outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
    size === "lg" ? "size-9" : "size-7",
  );

  return (
    <div
      className={cn(
        "inline-flex items-center overflow-hidden rounded-lg border",
        disabled && "opacity-60",
      )}
    >
      <button
        type="button"
        className={button}
        onClick={() => onChange(value - 1)}
        disabled={disabled || value <= 1}
        aria-label={`Decrease ${label.toLowerCase()}`}
      >
        <MinusIcon className="size-3.5" aria-hidden />
      </button>

      {/* `aria-live` so a screen reader hears the new count after a tap —
          the buttons keep focus, so nothing else would announce it. */}
      <span
        aria-live="polite"
        className={cn(
          "text-center font-mono text-xs font-semibold tabular-nums",
          size === "lg" ? "w-9 text-sm" : "w-8",
        )}
      >
        {value}
      </span>

      <button
        type="button"
        className={button}
        onClick={() => onChange(value + 1)}
        disabled={disabled || value >= ceiling}
        aria-label={`Increase ${label.toLowerCase()}`}
      >
        <PlusIcon className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
