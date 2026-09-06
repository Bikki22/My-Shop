"use client";

import { PlusIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Category } from "@/features/categories/types";
import { cn } from "@/lib/utils";
import { formatPrice } from "../lib/format";
import { DEFAULT_PRODUCT_FILTERS } from "../lib/product-filters";
import {
  PRODUCT_SORTS,
  PRODUCT_SORT_LABELS,
  type ProductFilters,
} from "../types";

interface ProductFiltersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: ProductFilters;
  categories: Category[];
  onApply: (filters: ProductFilters) => void;
}

/** Price bands, in rupees, offered as one-tap shortcuts. */
const PRICE_PRESETS: {
  label: string;
  min: number | null;
  max: number | null;
}[] = [
  { label: "Under 1,000", min: null, max: 1000 },
  { label: "1,000 to 5,000", min: 1000, max: 5000 },
  { label: "5,000 to 20,000", min: 5000, max: 20000 },
  { label: "20,000+", min: 20000, max: null },
];

/**
 * The filter sidebar, opened from the catalogue rail.
 *
 * It edits a *draft* and commits on submit rather than navigating per
 * click: choosing a category, then a price band, then a tag is one query
 * instead of three. The sheet unmounts its content while closed, so the
 * draft is always seeded fresh from whatever the URL currently says.
 */
export function ProductFiltersSheet({
  open,
  onOpenChange,
  filters,
  categories,
  onApply,
}: ProductFiltersSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-full gap-0 p-0 data-[side=left]:sm:max-w-md"
      >
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>
            Narrow the catalogue, then apply once.
          </SheetDescription>
        </SheetHeader>

        <FilterForm
          filters={filters}
          categories={categories}
          onApply={(next) => {
            onApply(next);
            onOpenChange(false);
          }}
        />
      </SheetContent>
    </Sheet>
  );
}

function FilterForm({
  filters,
  categories,
  onApply,
}: {
  filters: ProductFilters;
  categories: Category[];
  onApply: (filters: ProductFilters) => void;
}) {
  const [draft, setDraft] = useState<ProductFilters>(filters);
  const [tagInput, setTagInput] = useState("");

  const patch = (changes: Partial<ProductFilters>) => {
    setDraft((current) => ({ ...current, ...changes }));
  };

  const addTag = (raw: string) => {
    const tag = raw.trim().toLowerCase();
    if (!tag || draft.tags.includes(tag)) {
      setTagInput("");
      return;
    }
    patch({ tags: [...draft.tags, tag] });
    setTagInput("");
  };

  const onTagKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // Enter here would submit the form and close the sheet, which is not
    // what "I have finished typing this tag" means.
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag(tagInput);
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // A tag left in the box and never committed with Enter is still a tag
    // the visitor asked for.
    const tags = tagInput.trim()
      ? [...new Set([...draft.tags, tagInput.trim().toLowerCase()])]
      : draft.tags;
    onApply({ ...draft, tags });
  };

  const priceValue = (value: number | null) =>
    value === null ? "" : String(value);

  const parsePrice = (raw: string): number | null => {
    const parsed = Number(raw);
    return raw.trim() === "" || !Number.isFinite(parsed) || parsed < 0
      ? null
      : parsed;
  };

  const rangeIsEmpty =
    draft.minPrice !== null &&
    draft.maxPrice !== null &&
    draft.minPrice > draft.maxPrice;

  return (
    <form
      onSubmit={onSubmit}
      className="flex min-h-0 flex-1 flex-col"
      aria-label="Product filters"
    >
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <fieldset className="flex flex-col gap-3">
          <legend className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
            Sort by
          </legend>
          <div className="flex flex-wrap gap-2">
            {PRODUCT_SORTS.map((sort) => (
              <Chip
                key={sort}
                selected={draft.sort === sort}
                onClick={() => {
                  patch({ sort });
                }}
              >
                {PRODUCT_SORT_LABELS[sort]}
              </Chip>
            ))}
          </div>
        </fieldset>

        <Separator className="my-5" />

        <fieldset className="flex flex-col gap-3">
          <legend className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
            Category
          </legend>
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No categories available right now.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Chip
                selected={draft.categoryId === null}
                onClick={() => {
                  patch({ categoryId: null });
                }}
              >
                All
              </Chip>
              {categories.map((category) => (
                <Chip
                  key={category._id}
                  selected={draft.categoryId === category._id}
                  onClick={() => {
                    patch({
                      categoryId:
                        draft.categoryId === category._id ? null : category._id,
                    });
                  }}
                >
                  {category.name}
                </Chip>
              ))}
            </div>
          )}
        </fieldset>

        <Separator className="my-5" />

        <fieldset className="flex flex-col gap-3">
          <legend className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
            Price
          </legend>

          <div className="flex flex-wrap gap-2">
            {PRICE_PRESETS.map((preset) => {
              const selected =
                draft.minPrice === preset.min && draft.maxPrice === preset.max;
              return (
                <Chip
                  key={preset.label}
                  selected={selected}
                  onClick={() => {
                    patch({
                      minPrice: selected ? null : preset.min,
                      maxPrice: selected ? null : preset.max,
                    });
                  }}
                >
                  {preset.label}
                </Chip>
              );
            })}
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <div className="grid gap-1.5">
              <Label
                htmlFor="filter-min-price"
                className="text-xs text-muted-foreground"
              >
                Min
              </Label>
              <Input
                id="filter-min-price"
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="0"
                value={priceValue(draft.minPrice)}
                onChange={(event) => {
                  patch({ minPrice: parsePrice(event.target.value) });
                }}
                className="h-9"
              />
            </div>
            <span aria-hidden className="pb-2.5 text-muted-foreground">
              to
            </span>
            <div className="grid gap-1.5">
              <Label
                htmlFor="filter-max-price"
                className="text-xs text-muted-foreground"
              >
                Max
              </Label>
              <Input
                id="filter-max-price"
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="Any"
                value={priceValue(draft.maxPrice)}
                onChange={(event) => {
                  patch({ maxPrice: parsePrice(event.target.value) });
                }}
                className="h-9"
              />
            </div>
          </div>

          {rangeIsEmpty ? (
            <p className="text-xs text-destructive">
              {formatPrice(draft.minPrice ?? 0)} is above{" "}
              {formatPrice(draft.maxPrice ?? 0)} — that range matches nothing.
            </p>
          ) : null}
        </fieldset>

        <Separator className="my-5" />

        <fieldset className="flex flex-col gap-3">
          <legend className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
            Tags
          </legend>
          <div className="flex gap-2">
            <Input
              value={tagInput}
              onChange={(event) => {
                setTagInput(event.target.value);
              }}
              onKeyDown={onTagKeyDown}
              placeholder="cotton, summer"
              aria-label="Add a tag"
              className="h-9"
            />
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              className="size-9 shrink-0"
              onClick={() => {
                addTag(tagInput);
              }}
            >
              <PlusIcon />
              <span className="sr-only">Add tag</span>
            </Button>
          </div>

          {draft.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {draft.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                  {tag}
                  <button
                    type="button"
                    onClick={() => {
                      patch({ tags: draft.tags.filter((t) => t !== tag) });
                    }}
                    className="rounded-full p-0.5 transition-colors hover:bg-foreground/10"
                  >
                    <XIcon className="size-3" />
                    <span className="sr-only">Remove {tag}</span>
                  </button>
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Matches any product carrying one of the tags you add.
            </p>
          )}
        </fieldset>
      </div>

      <SheetFooter className="flex-row items-center gap-2 border-t bg-muted/40 px-5 py-4">
        <Button
          type="button"
          variant="ghost"
          size="lg"
          onClick={() => {
            setDraft({ ...DEFAULT_PRODUCT_FILTERS });
            setTagInput("");
          }}
        >
          <RotateCcwIcon data-icon="inline-start" />
          Clear all
        </Button>
        <Button type="submit" size="lg" className="ml-auto">
          Show results
        </Button>
      </SheetFooter>
    </form>
  );
}

/** A selectable pill. Plain buttons, so the whole group posts one form. */
function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm transition-colors outline-none",
        "focus-visible:ring-3 focus-visible:ring-ring/50",
        selected
          ? "border-transparent bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
