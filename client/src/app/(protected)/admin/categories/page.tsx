import type { Metadata } from "next";
import { TriangleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CategoryManager } from "@/features/categories/components/category-manager";
import { listCategoriesForAdmin } from "@/features/categories/server/admin";
import { pluralize } from "@/lib/format";

export const metadata: Metadata = {
  title: "Categories",
  description: "The catalogue tree every listing is filed under.",
};

/**
 * The category tree.
 *
 * Reads with `isActive` left undefined so both active and hidden categories
 * come back — the shopper-facing endpoint defaults to active only, which is
 * exactly wrong for the screen that manages them.
 */
export default async function AdminCategoriesPage() {
  const { page, error } = await listCategoriesForAdmin({
    page: 1,
    // Categories are a short, flat list — a hundred covers any real
    // catalogue, and paginating four rows would be worse than not.
    limit: 100,
  });

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Categories
        </h1>
        <p className="text-sm text-muted-foreground">
          {error
            ? "Categories are unavailable right now."
            : `${pluralize(page.pagination.total, "category", "categories")} in the catalogue.`}
        </p>
      </header>

      {error ? (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>Could not load categories</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : (
        <CategoryManager categories={page.data} />
      )}
    </>
  );
}
