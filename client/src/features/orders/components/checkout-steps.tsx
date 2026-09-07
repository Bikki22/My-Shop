import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The Cart → Checkout → Confirmation rail from the design.
 *
 * Deliberately not links: stepping back to a cart you have already checked
 * out of, or forward to a confirmation for an order that does not exist yet,
 * are both dead ends. It tells the shopper where they are, nothing more.
 */
const STEPS = ["Cart", "Checkout", "Confirmation"] as const;

export type CheckoutStep = (typeof STEPS)[number];

export function CheckoutSteps({ current }: { current: CheckoutStep }) {
  const currentIndex = STEPS.indexOf(current);

  return (
    <ol
      aria-label="Checkout progress"
      className="flex flex-wrap items-center gap-2 text-xs"
    >
      {STEPS.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;

        return (
          <li key={step} className="flex items-center gap-2">
            {index > 0 ? (
              <span aria-hidden className="h-px w-6 bg-border" />
            ) : null}

            <span
              className={cn(
                "flex items-center gap-1.5",
                active
                  ? "font-bold text-foreground"
                  : done
                    ? "font-semibold text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground",
              )}
              aria-current={active ? "step" : undefined}
            >
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full text-[0.625rem] font-bold",
                  done
                    ? "bg-emerald-500 text-white"
                    : active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {done ? <CheckIcon className="size-3" aria-hidden /> : index + 1}
              </span>
              {step}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
