import { CheckIcon, XIcon } from "lucide-react";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { trackerSteps, type Trackable } from "../lib/format";

/**
 * The four-milestone progress rail from the design: Placed → Packed →
 * Shipped → Delivered.
 *
 * It reads a **sub-order** on a detail page and the parent order on the
 * list, and both work because they carry the same three fields — see
 * `Trackable`. A cancelled order has no progress to show, so it says that
 * instead of drawing a rail of empty circles.
 */
export function OrderTracker({
  order,
  cancelReason,
  showDates = true,
}: {
  order: Trackable;
  cancelReason?: string | null;
  /**
   * Off for a **parent order**.
   *
   * The server appends to `statusHistory` on the sub-order it transitions,
   * and `syncParent` copies only the derived *status* upwards — so a parent
   * knows it has shipped but not when. The dots are still right; the dates
   * would be a row of em-dashes, and they are on the detail page's
   * per-parcel trackers instead.
   */
  showDates?: boolean;
}) {
  if (order.status === "CANCELLED") {
    return (
      <p className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-xs font-medium text-destructive">
        <XIcon className="size-3.5 shrink-0" aria-hidden />
        {cancelReason
          ? `Cancelled — ${cancelReason}`
          : "This order was cancelled."}
      </p>
    );
  }

  const steps = trackerSteps(order);

  return (
    <ol className="flex items-start">
      {steps.map((step, index) => (
        <li key={step.label} className="relative flex-1 text-center">
          {/* The connector belongs to the step on its right, drawn leftwards,
              so the first step has nothing trailing off the edge. */}
          {index > 0 ? (
            <span
              aria-hidden
              className={cn(
                "absolute top-3 -left-1/2 h-0.5 w-full",
                step.done ? "bg-emerald-500" : "bg-border",
              )}
            />
          ) : null}

          <span
            className={cn(
              "relative z-1 mx-auto flex size-6 items-center justify-center rounded-full text-[0.625rem] font-bold",
              step.done
                ? "bg-emerald-500 text-white"
                : "bg-muted text-muted-foreground",
              step.current && "ring-3 ring-emerald-500/25",
            )}
          >
            {step.done ? (
              <CheckIcon className="size-3" aria-hidden />
            ) : (
              index + 1
            )}
          </span>

          <span className="mt-2 block text-[0.6875rem] font-semibold">
            {step.label}
          </span>
          {showDates ? (
            <span className="block text-[0.625rem] text-muted-foreground">
              {step.at ? formatShortDate(step.at) : "—"}
            </span>
          ) : null}

          {step.current ? <span className="sr-only">(current step)</span> : null}
        </li>
      ))}
    </ol>
  );
}
