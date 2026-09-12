import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * One figure from a dashboard, in the ledger-tile shape the console mockups
 * use: the label and an optional pill across the top, the figure set in mono
 * beneath it, and a line of context under that.
 *
 * The value is passed pre-formatted rather than as a number plus a format
 * flag — some tiles are money, some are counts, and one is a percentage, and
 * a component that branched on which would end up owning formatting rules
 * that belong in `lib/format.ts`.
 *
 * Mono *is* tabular here, unlike the storefront's prices: these tiles sit in
 * a row of four and the mockups line their digits up like a column of
 * accounts.
 */
export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  tag,
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
  /**
   * The small pill beside the label — a unit or cadence that would otherwise
   * bloat the label itself ("NPR", "Weekly", "Live").
   */
  tag?: { label: string; tone?: "neutral" | "brand" | "success" | "danger" };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-border bg-card px-5 py-4",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        {tag ? (
          <span
            className={cn(
              "shrink-0 rounded-md px-1.5 py-0.5 text-[0.625rem] font-semibold",
              tag.tone === "brand" && "bg-brand-soft text-brand-soft-foreground",
              tag.tone === "success" && "bg-success-soft text-success",
              tag.tone === "danger" && "bg-danger-soft text-danger",
              (tag.tone ?? "neutral") === "neutral" &&
                "bg-muted text-muted-foreground",
            )}
          >
            {tag.label}
          </span>
        ) : null}
      </div>

      <span
        className={cn(
          "font-mono text-[1.625rem] leading-none font-semibold tracking-tight",
          tone === "attention" && "text-danger",
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
        "grid grid-cols-2 gap-4 lg:grid-cols-4",
        // Dimmed by the caller while a new range loads, so a refresh reads as
        // "catching up" rather than as the answer.
        className,
      )}
    >
      {children}
    </div>
  );
}
