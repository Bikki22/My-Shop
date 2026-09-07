import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * One figure from a dashboard, in the stat-tile contract: a label in sentence
 * case, the value, and an optional line of context under it.
 *
 * The value is passed pre-formatted rather than as a number plus a format
 * flag — some tiles are money, some are counts, and one is a percentage, and
 * a component that branched on which would end up owning formatting rules
 * that belong in `lib/format.ts`.
 *
 * Figures are deliberately *not* `tabular-nums`: that gives every digit the
 * width of a `0`, which reads loose at display sizes. Tabular figures are for
 * columns that must align vertically — the tables, and the chart's axis.
 */
export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  className,
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  /**
   * `attention` is for a figure that means someone has to do something — an
   * approval queue with a backlog, stock that has run out. It is a weight and
   * colour change, never colour alone: the label already says what it is.
   */
  tone?: "default" | "attention";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-xl bg-card px-4 py-3.5 ring-1 ring-foreground/10",
        className,
      )}
    >
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-heading text-2xl leading-tight font-semibold tracking-tight",
          tone === "attention" && "text-destructive",
        )}
      >
        {value}
      </span>
      {hint ? (
        <span className="text-xs text-muted-foreground">{hint}</span>
      ) : null}
    </div>
  );
}

/**
 * The responsive shell the tiles sit in.
 *
 * Its own component so every dashboard section wraps identically — the
 * platform overview has four groups of these and they should not each
 * re-decide their column counts.
 */
export function StatGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 lg:grid-cols-4",
        // Dimmed by the caller while a new range loads, so a refresh reads as
        // "catching up" rather than as the answer.
        className,
      )}
    >
      {children}
    </div>
  );
}
