"use client";

import { LoaderCircleIcon, SearchIcon, XIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { cn } from "@/lib/utils";
import { useProductFilters } from "../hooks/use-product-filters";

/** Long enough to cover a pause mid-word, short enough to feel live. */
const SEARCH_DEBOUNCE_MS = 350;

/**
 * The catalogue search box.
 *
 * The input is local state, so typing is never blocked by a round trip;
 * the debounced copy is what lands in the URL, which is what re-queries the
 * server.
 */
export function ProductSearch({ className }: { className?: string }) {
  const { filters, apply, isPending } = useProductFilters();
  const [value, setValue] = useState(filters.search);

  // The term this box expects the URL to hold: its own last submission,
  // or the last value it absorbed from elsewhere. It is what tells our own
  // navigations apart from someone else's — see the re-sync below.
  const [expected, setExpected] = useState(filters.search);

  const submit = (term: string) => {
    setExpected(term);
    apply({ search: term });
  };

  const search = useDebouncedCallback((term: string) => {
    submit(term.trim());
  }, SEARCH_DEBOUNCE_MS);

  if (filters.search !== expected) {
    // The term changed from somewhere else: a filter chip's dismiss button,
    // "Clear all", the back button. Adjusting state during render is
    // React's supported way to reset an input from a changed source, and
    // cheaper than the extra pass an effect would cost.
    //
    // Our own navigations are skipped by this check, which matters: copying
    // the URL back into the box while a query was still in flight would
    // overwrite whatever had been typed since.
    setExpected(filters.search);
    setValue(filters.search);
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    // Enter skips the wait rather than doing nothing for 350ms.
    event.preventDefault();
    search.cancel();
    submit(value.trim());
  };

  return (
    <form
      role="search"
      onSubmit={onSubmit}
      className={cn("relative flex-1", className)}
    >
      <SearchIcon
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        name="search"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          search(event.target.value);
        }}
        placeholder="Search products, brands and tags"
        aria-label="Search products"
        className="h-11 rounded-full border-transparent bg-muted/60 pr-11 pl-10 shadow-inner focus-visible:bg-background [&::-webkit-search-cancel-button]:hidden"
      />

      <div className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center">
        {isPending ? (
          <LoaderCircleIcon
            aria-label="Searching"
            className="size-4 animate-spin text-muted-foreground"
          />
        ) : value ? (
          <button
            type="button"
            onClick={() => {
              setValue("");
              search.cancel();
              submit("");
            }}
            className="rounded-full p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <XIcon className="size-4" />
            <span className="sr-only">Clear search</span>
          </button>
        ) : null}
      </div>
    </form>
  );
}
