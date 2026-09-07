import { TriangleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { isApiError } from "@/lib/api";

/**
 * What a dashboard shows when its aggregation could not be read.
 *
 * A panel rather than a thrown error: the range chips and the page's own
 * navigation stay usable, so an operator can try a shorter window or move on
 * to a screen that does work. The same reasoning as `listMyOrders` returning
 * its failure instead of throwing.
 */
export function DashboardError({
  error,
  what,
}: {
  error: unknown;
  what: string;
}) {
  return (
    <Alert variant="destructive">
      <TriangleAlertIcon />
      <AlertTitle>Could not load {what}</AlertTitle>
      <AlertDescription>
        {isApiError(error)
          ? error.message
          : "Something went wrong reading these figures."}
      </AlertDescription>
    </Alert>
  );
}
